import { query } from '../../../packages/db/src/connection';
import { config } from '../../../packages/config/src/config';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:tenant');

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_expires_at: string | null;
  max_numbers: number;
  max_monthly_messages: number;
  custom_domain: string | null;
  stripe_customer_id: string | null;
  setup_fee_paid: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TenantNumber {
  id: string;
  tenant_id: string;
  phone_number_id: string;
  phone_number: string | null;
  display_name: string | null;
  access_token: string;
  waba_id: string | null;
  verify_token: string | null;
  webhook_url: string | null;
  is_active: boolean;
  messages_sent_this_month: number;
  created_at: string;
}

// ── Plan limits ───────────────────────────────────────────────────────────────

type PlanKey = 'trial' | 'starter' | 'pro' | 'enterprise';
type PlanConfig = { maxNumbers: number; maxMessages: number };

const PLAN_LIMITS: Record<PlanKey, PlanConfig> = {
  trial:      { maxNumbers: 2,   maxMessages: 500 },
  starter:    { maxNumbers: config.stripe.plans.starter.maxNumbers,   maxMessages: config.stripe.plans.starter.maxMessages },
  pro:        { maxNumbers: config.stripe.plans.pro.maxNumbers,       maxMessages: config.stripe.plans.pro.maxMessages },
  enterprise: { maxNumbers: config.stripe.plans.enterprise.maxNumbers, maxMessages: config.stripe.plans.enterprise.maxMessages },
};

export function getPlanLimits(plan: string): PlanConfig {
  return PLAN_LIMITS[(plan as PlanKey)] ?? PLAN_LIMITS.trial;
}

// ── Tenant CRUD ───────────────────────────────────────────────────────────────

export class TenantService {
  static async create(data: { name: string; slug: string; plan?: string; customDomain?: string }): Promise<Tenant> {
    const plan = data.plan ?? 'trial';
    const limits = getPlanLimits(plan);
    const res = await query<Tenant>(
      `INSERT INTO tenants (name, slug, plan, max_numbers, max_monthly_messages, custom_domain)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.name, data.slug, plan, limits.maxNumbers, limits.maxMessages, data.customDomain ?? null]
    );
    return res.rows[0];
  }

  static async getById(id: string): Promise<Tenant | null> {
    const res = await query<Tenant>(`SELECT * FROM tenants WHERE id = $1`, [id]);
    return res.rows[0] ?? null;
  }

  static async getBySlug(slug: string): Promise<Tenant | null> {
    const res = await query<Tenant>(`SELECT * FROM tenants WHERE slug = $1`, [slug]);
    return res.rows[0] ?? null;
  }

  static async list(limit = 50, offset = 0, search?: string): Promise<{ tenants: Tenant[]; total: number }> {
    const searchClause = search ? `AND (name ILIKE $3 OR slug ILIKE $3)` : '';
    const params: (string | number)[] = search
      ? [limit, offset, `%${search}%`]
      : [limit, offset];

    const [rows, count] = await Promise.all([
      query<Tenant>(
        `SELECT * FROM tenants WHERE is_active = true ${searchClause}
         ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        params
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM tenants WHERE is_active = true ${searchClause}`,
        search ? [`%${search}%`] : []
      ),
    ]);
    return { tenants: rows.rows, total: parseInt(count.rows[0]?.count ?? '0') };
  }

  static async update(id: string, data: Partial<Pick<Tenant, 'name' | 'custom_domain' | 'plan' | 'is_active' | 'setup_fee_paid'>>): Promise<Tenant | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (data.name !== undefined)           { sets.push(`name = $${i++}`);            vals.push(data.name); }
    if (data.custom_domain !== undefined)   { sets.push(`custom_domain = $${i++}`);   vals.push(data.custom_domain); }
    if (data.plan !== undefined) {
      const limits = getPlanLimits(data.plan);
      sets.push(`plan = $${i++}`);          vals.push(data.plan);
      sets.push(`max_numbers = $${i++}`);   vals.push(limits.maxNumbers);
      sets.push(`max_monthly_messages = $${i++}`); vals.push(limits.maxMessages);
    }
    if (data.is_active !== undefined)       { sets.push(`is_active = $${i++}`);       vals.push(data.is_active); }
    if (data.setup_fee_paid !== undefined)  { sets.push(`setup_fee_paid = $${i++}`);  vals.push(data.setup_fee_paid); }

    if (sets.length === 0) return TenantService.getById(id);

    sets.push(`updated_at = NOW()`);
    vals.push(id);
    const res = await query<Tenant>(
      `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return res.rows[0] ?? null;
  }

  static async delete(id: string): Promise<boolean> {
    const res = await query(`UPDATE tenants SET is_active = false, updated_at = NOW() WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Numbers ─────────────────────────────────────────────────────────────────

  static async addNumber(data: {
    tenantId: string;
    phoneNumberId: string;
    accessToken: string;
    phoneNumber?: string;
    displayName?: string;
    wabaId?: string;
    verifyToken?: string;
    webhookUrl?: string;
  }): Promise<TenantNumber> {
    // Check plan limit
    const tenant = await TenantService.getById(data.tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const currentCount = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tenant_numbers WHERE tenant_id = $1 AND is_active = true`,
      [data.tenantId]
    );
    const used = parseInt(currentCount.rows[0]?.count ?? '0');
    if (used >= tenant.max_numbers) {
      throw new Error(`Plan limit reached: max ${tenant.max_numbers} numbers allowed on ${tenant.plan} plan`);
    }

    const res = await query<TenantNumber>(
      `INSERT INTO tenant_numbers
         (tenant_id, phone_number_id, access_token, phone_number, display_name, waba_id, verify_token, webhook_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, phone_number_id) DO UPDATE
         SET access_token = EXCLUDED.access_token,
             phone_number = EXCLUDED.phone_number,
             display_name = EXCLUDED.display_name,
             waba_id = EXCLUDED.waba_id,
             verify_token = EXCLUDED.verify_token,
             webhook_url = EXCLUDED.webhook_url,
             updated_at = NOW()
       RETURNING *`,
      [
        data.tenantId, data.phoneNumberId, data.accessToken,
        data.phoneNumber ?? null, data.displayName ?? null,
        data.wabaId ?? null, data.verifyToken ?? null, data.webhookUrl ?? null,
      ]
    );
    return res.rows[0];
  }

  static async listNumbers(tenantId: string): Promise<TenantNumber[]> {
    const res = await query<TenantNumber>(
      `SELECT * FROM tenant_numbers WHERE tenant_id = $1 ORDER BY created_at ASC`,
      [tenantId]
    );
    return res.rows;
  }

  static async removeNumber(tenantId: string, numberId: string): Promise<boolean> {
    const res = await query(
      `UPDATE tenant_numbers SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [numberId, tenantId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  static async getStats(tenantId: string) {
    const [numbers, sub, carts, conversions] = await Promise.all([
      query<{ count: string; active: string }>(
        `SELECT COUNT(*) AS count,
                SUM(CASE WHEN is_active THEN 1 ELSE 0 END) AS active
         FROM tenant_numbers WHERE tenant_id = $1`,
        [tenantId]
      ),
      query(
        `SELECT plan, status, current_period_end FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [tenantId]
      ),
      query<{ count: string; recovered: string }>(
        `SELECT COUNT(*) AS count,
                SUM(CASE WHEN status = 'recovered' THEN 1 ELSE 0 END) AS recovered
         FROM cart_sessions WHERE tenant_id = $1`,
        [tenantId]
      ).catch(() => ({ rows: [{ count: '0', recovered: '0' }] })),
      query<{ total_value: string; count: string }>(
        `SELECT COALESCE(SUM(order_value),0) AS total_value, COUNT(*) AS count
         FROM conversions WHERE tenant_id = $1 AND converted_at > NOW() - INTERVAL '30 days'`,
        [tenantId]
      ).catch(() => ({ rows: [{ total_value: '0', count: '0' }] })),
    ]);

    return {
      numbers: {
        total: parseInt(numbers.rows[0]?.count ?? '0'),
        active: parseInt(numbers.rows[0]?.active ?? '0'),
      },
      subscription: sub.rows[0] ?? null,
      cartRecovery: {
        total: parseInt(carts.rows[0]?.count ?? '0'),
        recovered: parseInt(carts.rows[0]?.recovered ?? '0'),
      },
      conversions: {
        count: parseInt(conversions.rows[0]?.count ?? '0'),
        totalValue: parseFloat(conversions.rows[0]?.total_value ?? '0'),
      },
    };
  }
}
