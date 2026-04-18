/**
 * Membership Renewal Bot service — expiry tracking, reminders, payments, tier management.
 */
import { query } from '../../../packages/db/src/connection';
import { ProductService } from './product.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:membership');

export interface Membership {
  id: string; tenant_id: string; product_id: string;
  customer_name: string | null; customer_phone: string; customer_email: string | null;
  tier: string; start_date: string; expiry_date: string;
  status: string; auto_renew: boolean;
  payment_link: string | null; payment_status: string;
  amount: number; currency: string; renewal_count: number;
  reminder_7d_sent: boolean; reminder_1d_sent: boolean;
  reminder_expiry_sent: boolean; late_fee: number;
  notes: string | null; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export class MembershipService {
  // ── CRUD ──────────────────────────────────────────────────────────
  static async create(tenantId: string, productId: string, data: {
    customer_name?: string; customer_phone: string; customer_email?: string;
    tier?: string; start_date: string; expiry_date: string;
    auto_renew?: boolean; payment_link?: string;
    amount: number; currency?: string;
    notes?: string; metadata?: Record<string, unknown>;
  }): Promise<Membership> {
    const res = await query<Membership>(
      `INSERT INTO memberships (tenant_id, product_id, customer_name, customer_phone, customer_email,
         tier, start_date, expiry_date, auto_renew, payment_link, amount, currency, notes, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) RETURNING *`,
      [tenantId, productId, data.customer_name ?? null, data.customer_phone,
       data.customer_email ?? null, data.tier ?? 'standard',
       data.start_date, data.expiry_date, data.auto_renew ?? false,
       data.payment_link ?? null, data.amount, data.currency ?? 'INR',
       data.notes ?? null, JSON.stringify(data.metadata ?? {})]
    );
    await ProductService.logEvent(tenantId, productId, 'membership', 'membership_created',
      res.rows[0].id, 'membership');
    return res.rows[0];
  }

  static async list(tenantId: string, opts?: {
    status?: string; tier?: string; limit?: number; offset?: number;
  }): Promise<{ memberships: Membership[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    if (opts?.tier) { params.push(opts.tier); conds.push(`tier = $${params.length}`); }
    const where = conds.join(' AND ');
    params.push(opts?.limit ?? 50, opts?.offset ?? 0);
    const [rows, cnt] = await Promise.all([
      query<Membership>(`SELECT * FROM memberships WHERE ${where} ORDER BY expiry_date ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM memberships WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { memberships: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getById(id: string): Promise<Membership | null> {
    const res = await query<Membership>('SELECT * FROM memberships WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async update(id: string, data: Partial<{
    customer_name: string; customer_phone: string; customer_email: string;
    tier: string; start_date: string; expiry_date: string; status: string;
    auto_renew: boolean; payment_link: string; amount: number; currency: string;
    notes: string; late_fee: number;
  }>): Promise<Membership | null> {
    const sets: string[] = []; const params: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      params.push(v); sets.push(`${k} = $${params.length}`);
    }
    if (!sets.length) return this.getById(id);
    sets.push('updated_at = NOW()');
    params.push(id);
    const res = await query<Membership>(
      `UPDATE memberships SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  static async deleteMembership(id: string): Promise<boolean> {
    const res = await query('DELETE FROM memberships WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Renewal ───────────────────────────────────────────────────────
  static async renew(id: string, newExpiryDate: string, paymentLink?: string): Promise<Membership | null> {
    const res = await query<Membership>(
      `UPDATE memberships SET status = 'renewed', expiry_date = $1, payment_link = $2,
         payment_status = 'pending', renewal_count = renewal_count + 1,
         reminder_7d_sent = false, reminder_1d_sent = false, reminder_expiry_sent = false,
         updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [newExpiryDate, paymentLink ?? null, id]
    );
    const m = res.rows[0];
    if (m) {
      await ProductService.logEvent(m.tenant_id, m.product_id, 'membership', 'membership_renewed',
        id, 'membership', { newExpiryDate, renewalCount: m.renewal_count });
    }
    return m;
  }

  static async recordPayment(id: string, paymentStatus: string): Promise<Membership | null> {
    const newStatus = paymentStatus === 'paid' ? 'active' : 'expiring';
    const res = await query<Membership>(
      `UPDATE memberships SET payment_status = $1, status = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [paymentStatus, newStatus, id]
    );
    const m = res.rows[0];
    if (m && paymentStatus === 'paid') {
      await ProductService.notify(m.tenant_id, 'membership', 'payment_received',
        'Membership Payment Received',
        `${m.customer_name ?? m.customer_phone} paid ${m.currency} ${m.amount} for ${m.tier} membership`,
        { entityId: id });
    }
    return m;
  }

  // ── Worker helpers ────────────────────────────────────────────────
  static async getExpiring7d(): Promise<Membership[]> {
    const res = await query<Membership>(
      `SELECT * FROM memberships WHERE status = 'active' AND reminder_7d_sent = false
         AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`, []
    );
    return res.rows;
  }

  static async getExpiring1d(): Promise<Membership[]> {
    const res = await query<Membership>(
      `SELECT * FROM memberships WHERE status IN ('active','expiring') AND reminder_1d_sent = false
         AND expiry_date = CURRENT_DATE + INTERVAL '1 day'`, []
    );
    return res.rows;
  }

  static async getExpiredToday(): Promise<Membership[]> {
    const res = await query<Membership>(
      `SELECT * FROM memberships WHERE status IN ('active','expiring') AND reminder_expiry_sent = false
         AND expiry_date <= CURRENT_DATE`, []
    );
    return res.rows;
  }

  static async markReminder7dSent(id: string): Promise<void> {
    await query("UPDATE memberships SET reminder_7d_sent = true, status = 'expiring', updated_at = NOW() WHERE id = $1", [id]);
  }

  static async markReminder1dSent(id: string): Promise<void> {
    await query('UPDATE memberships SET reminder_1d_sent = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  static async markExpirySent(id: string): Promise<void> {
    await query("UPDATE memberships SET reminder_expiry_sent = true, status = 'expired', updated_at = NOW() WHERE id = $1", [id]);
  }

  // ── Stats ─────────────────────────────────────────────────────────
  static async getStats(tenantId: string) {
    const res = await query<{
      total: string; active: string; expiring: string; expired: string;
      renewed: string; cancelled: string; revenue: string; avg_amount: string;
    }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'expiring' THEN 1 ELSE 0 END) AS expiring,
              SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS expired,
              SUM(CASE WHEN status = 'renewed' THEN 1 ELSE 0 END) AS renewed,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) AS revenue,
              COALESCE(AVG(amount), 0) AS avg_amount
       FROM memberships WHERE tenant_id = $1`,
      [tenantId]
    );
    const r = res.rows[0];
    const total = parseInt(r?.total ?? '0');
    const renewed = parseInt(r?.renewed ?? '0');
    return {
      total,
      active: parseInt(r?.active ?? '0'),
      expiring: parseInt(r?.expiring ?? '0'),
      expired: parseInt(r?.expired ?? '0'),
      renewed,
      cancelled: parseInt(r?.cancelled ?? '0'),
      revenue: parseFloat(r?.revenue ?? '0'),
      avgAmount: parseFloat(parseFloat(r?.avg_amount ?? '0').toFixed(2)),
      renewalRate: total > 0 ? Math.round((renewed / total) * 100) : 0,
    };
  }
}
