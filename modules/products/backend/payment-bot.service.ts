/**
 * Payment Collection Bot service — recurring reminders, payment links, escalation.
 */
import { query } from '../../../packages/db/src/connection';
import { ProductService } from './product.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:payment-bot');

export interface PaymentCollection {
  id: string;
  tenant_id: string;
  product_id: string;
  customer_name: string | null;
  customer_phone: string;
  customer_email: string | null;
  customer_group: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  due_date: string;
  status: string;
  payment_link: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  escalated_at: string | null;
  paid_at: string | null;
  receipt_sent: boolean;
  late_fee: number;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class PaymentBotService {
  // ── CRUD ──────────────────────────────────────────────────────────────
  static async create(tenantId: string, productId: string, data: {
    customer_name?: string; customer_phone: string; customer_email?: string;
    customer_group?: string; amount_due: number; currency?: string;
    due_date: string; payment_link?: string; notes?: string;
  }): Promise<PaymentCollection> {
    const res = await query<PaymentCollection>(
      `INSERT INTO payment_collections
         (tenant_id, product_id, customer_name, customer_phone, customer_email,
          customer_group, amount_due, currency, due_date, payment_link, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [tenantId, productId, data.customer_name ?? null, data.customer_phone,
       data.customer_email ?? null, data.customer_group ?? null,
       data.amount_due, data.currency ?? 'INR', data.due_date,
       data.payment_link ?? null, data.notes ?? null]
    );
    return res.rows[0];
  }

  static async list(tenantId: string, opts?: {
    status?: string; group?: string; limit?: number; offset?: number;
  }): Promise<{ collections: PaymentCollection[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    if (opts?.group) { params.push(opts.group); conds.push(`customer_group = $${params.length}`); }
    const where = conds.join(' AND ');
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    params.push(limit, offset);

    const [rows, cnt] = await Promise.all([
      query<PaymentCollection>(`SELECT * FROM payment_collections WHERE ${where} ORDER BY due_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM payment_collections WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { collections: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getById(id: string): Promise<PaymentCollection | null> {
    const res = await query<PaymentCollection>('SELECT * FROM payment_collections WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async update(id: string, data: Partial<{
    amount_due: number; due_date: string; payment_link: string;
    customer_group: string; notes: string; late_fee: number;
  }>): Promise<PaymentCollection | null> {
    const sets = ['updated_at = NOW()'];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) { params.push(v); sets.push(`${k} = $${params.length}`); }
    }
    if (!params.length) return null;
    params.push(id);
    const res = await query<PaymentCollection>(
      `UPDATE payment_collections SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    return res.rows[0] ?? null;
  }

  // ── Payment recording ─────────────────────────────────────────────────
  static async recordPayment(id: string, amount: number): Promise<PaymentCollection | null> {
    const res = await query<PaymentCollection>(
      `UPDATE payment_collections
         SET amount_paid = amount_paid + $1,
             status = CASE
               WHEN amount_paid + $1 >= amount_due THEN 'paid'
               WHEN $1 > 0 THEN 'partial'
               ELSE status
             END,
             paid_at = CASE WHEN amount_paid + $1 >= amount_due THEN NOW() ELSE paid_at END,
             updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [amount, id]
    );
    const coll = res.rows[0];
    if (!coll) return null;

    if (coll.status === 'paid') {
      await ProductService.logEvent(coll.tenant_id, coll.product_id, 'payment', 'payment_completed', id, 'payment_collection', { amount });
      await ProductService.notify(coll.tenant_id, 'payment', 'payment_received', 'Payment Received',
        `${coll.customer_name ?? coll.customer_phone} paid ${coll.currency} ${amount}`,
        { entityId: id });
    }

    return coll;
  }

  static async markReceiptSent(id: string): Promise<void> {
    await query('UPDATE payment_collections SET receipt_sent = true, updated_at = NOW() WHERE id = $1', [id]);
  }

  // ── Reminder tracking ─────────────────────────────────────────────────
  static async recordReminderSent(id: string): Promise<void> {
    await query(
      `UPDATE payment_collections SET reminder_count = reminder_count + 1,
         last_reminder_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  static async escalate(id: string): Promise<PaymentCollection | null> {
    const res = await query<PaymentCollection>(
      `UPDATE payment_collections SET status = 'escalated', escalated_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    const coll = res.rows[0];
    if (coll) {
      await ProductService.notify(coll.tenant_id, 'payment', 'payment_escalated',
        'Payment Escalated', `${coll.customer_name ?? coll.customer_phone} - ${coll.currency} ${coll.amount_due} overdue after ${coll.reminder_count} reminders`,
        { entityId: id, priority: 'high' });
    }
    return coll ?? null;
  }

  // ── Get pending reminders (due and not fully paid) ────────────────────
  static async getDuePayments(): Promise<PaymentCollection[]> {
    const res = await query<PaymentCollection>(
      `SELECT * FROM payment_collections
       WHERE status IN ('pending','partial','overdue')
         AND due_date <= CURRENT_DATE
       ORDER BY due_date
       LIMIT 200`
    );
    return res.rows;
  }

  // ── Get items needing escalation (3+ reminders, still unpaid) ─────────
  static async getEscalationCandidates(): Promise<PaymentCollection[]> {
    const res = await query<PaymentCollection>(
      `SELECT * FROM payment_collections
       WHERE status IN ('pending','partial','overdue')
         AND reminder_count >= 3 AND escalated_at IS NULL
       ORDER BY due_date
       LIMIT 100`
    );
    return res.rows;
  }

  // ── Mark overdue ──────────────────────────────────────────────────────
  static async markOverdue(): Promise<number> {
    const res = await query(
      `UPDATE payment_collections SET status = 'overdue', updated_at = NOW()
       WHERE status = 'pending' AND due_date < CURRENT_DATE`
    );
    return res.rowCount ?? 0;
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  static async getStats(tenantId: string) {
    const res = await query<{
      total: string; pending: string; paid: string; overdue: string;
      escalated: string; total_due: string; total_collected: string; total_late_fees: string;
    }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
              SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) AS overdue,
              SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalated,
              COALESCE(SUM(amount_due), 0) AS total_due,
              COALESCE(SUM(amount_paid), 0) AS total_collected,
              COALESCE(SUM(late_fee), 0) AS total_late_fees
       FROM payment_collections WHERE tenant_id = $1`,
      [tenantId]
    );
    const r = res.rows[0];
    const total = parseInt(r?.total ?? '0');
    const paid = parseInt(r?.paid ?? '0');
    return {
      total,
      pending: parseInt(r?.pending ?? '0'),
      paid,
      overdue: parseInt(r?.overdue ?? '0'),
      escalated: parseInt(r?.escalated ?? '0'),
      collectionRate: total > 0 ? Math.round((paid / total) * 100) : 0,
      totalDue: parseFloat(r?.total_due ?? '0'),
      totalCollected: parseFloat(r?.total_collected ?? '0'),
      totalLateFees: parseFloat(r?.total_late_fees ?? '0'),
    };
  }
}
