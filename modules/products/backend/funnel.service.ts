/**
 * Funnel-in-a-Box service — Meta Ads webhook → lead capture → multi-step WhatsApp automation.
 */
import { query } from '../../../packages/db/src/connection';
import { publishEvent } from '../../../packages/db/src/redis';
import { ProductService } from './product.service';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:funnel');

export interface FunnelLead {
  id: string;
  tenant_id: string;
  product_id: string;
  name: string | null;
  phone: string;
  email: string | null;
  interest: string | null;
  source: string;
  status: string;
  score: number;
  assigned_to: string | null;
  payment_link: string | null;
  payment_status: string;
  payment_amount: number;
  click_count: number;
  reply_count: number;
  current_step: number;
  notes: string | null;
  metadata: Record<string, unknown>;
  last_contacted_at: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FunnelStep {
  id: string;
  product_id: string;
  step_number: number;
  delay_hours: number;
  action_type: string;
  message_template: string | null;
  document_url: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export class FunnelService {
  // ── Lead capture (from Meta Ads webhook) ──────────────────────────────
  static async captureLead(tenantId: string, productId: string, data: {
    name?: string; phone: string; email?: string; interest?: string;
    source?: string; metadata?: Record<string, unknown>;
  }): Promise<FunnelLead> {
    const res = await query<FunnelLead>(
      `INSERT INTO funnel_leads (tenant_id, product_id, name, phone, email, interest, source, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT DO NOTHING RETURNING *`,
      [tenantId, productId, data.name ?? null, data.phone, data.email ?? null,
       data.interest ?? null, data.source ?? 'meta_ads', JSON.stringify(data.metadata ?? {})]
    );

    // If conflict (duplicate phone), update instead
    if (!res.rows[0]) {
      const upd = await query<FunnelLead>(
        `UPDATE funnel_leads SET name = COALESCE($2, name), email = COALESCE($3, email),
                interest = COALESCE($4, interest), updated_at = NOW()
         WHERE tenant_id = $1 AND phone = $5 RETURNING *`,
        [tenantId, data.name ?? null, data.email ?? null, data.interest ?? null, data.phone]
      );
      return upd.rows[0];
    }

    const lead = res.rows[0];

    // Log event + notification
    await ProductService.logEvent(tenantId, productId, 'funnel', 'lead_captured', lead.id, 'funnel_lead', { phone: data.phone, source: data.source });
    await ProductService.notify(tenantId, 'funnel', 'new_lead', 'New Lead Captured',
      `${data.name ?? data.phone} from ${data.source ?? 'Meta Ads'}`, { entityId: lead.id });

    return lead;
  }

  // ── Lead CRUD ─────────────────────────────────────────────────────────
  static async listLeads(tenantId: string, opts?: {
    productId?: string; status?: string; limit?: number; offset?: number;
  }): Promise<{ leads: FunnelLead[]; total: number }> {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (opts?.productId) { params.push(opts.productId); conds.push(`product_id = $${params.length}`); }
    if (opts?.status) { params.push(opts.status); conds.push(`status = $${params.length}`); }
    const where = conds.join(' AND ');
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    params.push(limit, offset);

    const [rows, cnt] = await Promise.all([
      query<FunnelLead>(`SELECT * FROM funnel_leads WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM funnel_leads WHERE ${where}`, params.slice(0, -2)),
    ]);
    return { leads: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async getLead(id: string): Promise<FunnelLead | null> {
    const res = await query<FunnelLead>('SELECT * FROM funnel_leads WHERE id = $1', [id]);
    return res.rows[0] ?? null;
  }

  static async updateLead(id: string, data: Partial<{
    status: string; score: number; assigned_to: string; payment_link: string;
    payment_status: string; payment_amount: number; notes: string;
  }>): Promise<FunnelLead | null> {
    const sets = ['updated_at = NOW()'];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) { params.push(v); sets.push(`${k} = $${params.length}`); }
    }
    if (params.length === 0) return FunnelService.getLead(id);
    params.push(id);
    const res = await query<FunnelLead>(
      `UPDATE funnel_leads SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params
    );
    const lead = res.rows[0] ?? null;

    // Score-based hot lead detection
    if (lead && lead.score >= 50 && data.score !== undefined) {
      await query('UPDATE funnel_leads SET status = $1 WHERE id = $2 AND status NOT IN ($3,$4)', ['hot', id, 'hot', 'converted']);
      await ProductService.notify(lead.tenant_id, 'funnel', 'hot_lead', 'Hot Lead Alert!',
        `${lead.name ?? lead.phone} scored ${lead.score}`, { entityId: id, priority: 'high' });
    }

    return lead;
  }

  static async recordClick(leadId: string): Promise<void> {
    await query(
      `UPDATE funnel_leads SET click_count = click_count + 1, score = score + 5, updated_at = NOW() WHERE id = $1`,
      [leadId]
    );
  }

  static async recordReply(leadId: string): Promise<void> {
    await query(
      `UPDATE funnel_leads SET reply_count = reply_count + 1, score = score + 10, updated_at = NOW() WHERE id = $1`,
      [leadId]
    );
    // Check if should become hot
    const lead = await FunnelService.getLead(leadId);
    if (lead && lead.score >= 50 && lead.status !== 'hot' && lead.status !== 'converted') {
      await query('UPDATE funnel_leads SET status = $1 WHERE id = $2', ['hot', leadId]);
      await ProductService.notify(lead.tenant_id, 'funnel', 'hot_lead', 'Hot Lead Alert!',
        `${lead.name ?? lead.phone} replied (score ${lead.score})`, { entityId: leadId, priority: 'high' });
    }
  }

  static async advanceStep(leadId: string): Promise<void> {
    await query(
      'UPDATE funnel_leads SET current_step = current_step + 1, last_contacted_at = NOW(), updated_at = NOW() WHERE id = $1',
      [leadId]
    );
  }

  static async markConverted(leadId: string): Promise<void> {
    await query(
      `UPDATE funnel_leads SET status = 'converted', converted_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [leadId]
    );
  }

  // ── Steps CRUD ────────────────────────────────────────────────────────
  static async listSteps(productId: string): Promise<FunnelStep[]> {
    const res = await query<FunnelStep>(
      'SELECT * FROM funnel_steps WHERE product_id = $1 ORDER BY step_number', [productId]
    );
    return res.rows;
  }

  static async upsertStep(productId: string, data: {
    step_number: number; delay_hours: number; action_type: string;
    message_template?: string; document_url?: string; config?: Record<string, unknown>;
  }): Promise<FunnelStep> {
    const res = await query<FunnelStep>(
      `INSERT INTO funnel_steps (product_id, step_number, delay_hours, action_type, message_template, document_url, config)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (product_id, step_number) DO UPDATE
         SET delay_hours = EXCLUDED.delay_hours, action_type = EXCLUDED.action_type,
             message_template = EXCLUDED.message_template, document_url = EXCLUDED.document_url,
             config = EXCLUDED.config
       RETURNING *`,
      [productId, data.step_number, data.delay_hours, data.action_type,
       data.message_template ?? null, data.document_url ?? null, JSON.stringify(data.config ?? {})]
    );
    return res.rows[0];
  }

  static async deleteStep(productId: string, stepNumber: number): Promise<boolean> {
    const res = await query('DELETE FROM funnel_steps WHERE product_id = $1 AND step_number = $2', [productId, stepNumber]);
    return (res.rowCount ?? 0) > 0;
  }

  // ── Step execution log ────────────────────────────────────────────────
  static async logStepExecution(leadId: string, stepId: string, status: string, errorMessage?: string): Promise<void> {
    await query(
      'INSERT INTO funnel_step_logs (lead_id, step_id, status, error_message) VALUES ($1,$2,$3,$4)',
      [leadId, stepId, status, errorMessage ?? null]
    );
  }

  // ── Stats ─────────────────────────────────────────────────────────────
  static async getStats(tenantId: string, productId?: string) {
    const conds = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    if (productId) { params.push(productId); conds.push(`product_id = $${params.length}`); }
    const where = conds.join(' AND ');

    const res = await query<{
      total: string; new_count: string; contacted: string; hot: string;
      converted: string; lost: string; total_payment: string;
    }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
              SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) AS contacted,
              SUM(CASE WHEN status = 'hot' THEN 1 ELSE 0 END) AS hot,
              SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted,
              SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN payment_amount ELSE 0 END), 0) AS total_payment
       FROM funnel_leads WHERE ${where}`,
      params
    );

    const r = res.rows[0];
    const total = parseInt(r?.total ?? '0');
    const converted = parseInt(r?.converted ?? '0');
    return {
      total,
      new: parseInt(r?.new_count ?? '0'),
      contacted: parseInt(r?.contacted ?? '0'),
      hot: parseInt(r?.hot ?? '0'),
      converted,
      lost: parseInt(r?.lost ?? '0'),
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      totalPayment: parseFloat(r?.total_payment ?? '0'),
    };
  }

  // ── Meta Ads webhook processing ───────────────────────────────────────
  static async handleMetaAdsWebhook(tenantId: string, productId: string, payload: Record<string, unknown>): Promise<FunnelLead | null> {
    try {
      // Extract lead data from Meta Lead Ads format
      const fieldData = (payload.field_data as Array<{ name: string; values: string[] }>) ?? [];
      const nameField = fieldData.find(f => f.name === 'full_name' || f.name === 'first_name');
      const phoneField = fieldData.find(f => f.name === 'phone_number' || f.name === 'phone');
      const emailField = fieldData.find(f => f.name === 'email');

      const phone = phoneField?.values?.[0] ?? (payload.phone as string) ?? null;
      if (!phone) {
        log.warn('Meta Ads webhook missing phone', { tenantId });
        return null;
      }

      return FunnelService.captureLead(tenantId, productId, {
        name: nameField?.values?.[0] ?? (payload.name as string),
        phone,
        email: emailField?.values?.[0] ?? (payload.email as string),
        interest: payload.interest as string,
        source: 'meta_ads',
        metadata: { leadgenId: payload.leadgen_id, formId: payload.form_id, adId: payload.ad_id },
      });
    } catch (err) {
      log.error('Meta Ads webhook processing failed', err);
      return null;
    }
  }
}
