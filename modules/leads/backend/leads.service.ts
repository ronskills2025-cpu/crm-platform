import { query } from '../../../packages/db/src/connection';
import { publishEvent } from '../../../packages/db/src/redis';
import { automationQueue } from '../../../packages/utils/src/queues';
import type { Lead } from './Lead';

// Nil UUID sentinel — used when no tenant_id is available (e.g. webhook context)
export const NIL_TENANT = '00000000-0000-0000-0000-000000000000';

function normalizeContact(channel: string, raw: string): string {
  if (channel === 'email') return raw.trim().toLowerCase();
  return raw.trim().replace(/^\+/, '').replace(/\s+/g, '');
}

function derivePhone(channel: string, contactValue: string): string | null {
  if (['whatsapp', 'sms', 'telegram'].includes(channel)) return contactValue;
  return null;
}

function deriveEmail(channel: string, contactValue: string): string | null {
  if (channel === 'email') return contactValue;
  return null;
}

export class LeadsService {
  // ── Upsert from any incoming channel message ───────────────────────────

  static async upsertFromIncoming(
    channel: 'whatsapp' | 'sms' | 'email' | 'telegram' | 'messenger' | 'instagram',
    contactValue: string,
    extra?: {
      name?: string; source?: string; campaign_id?: string | null;
      is_vip?: boolean; assigned_to?: string; tenant_id?: string;
    }
  ): Promise<Lead> {
    const normalized = normalizeContact(channel, contactValue);
    const tenantId = extra?.tenant_id ?? NIL_TENANT;
    const source = extra?.source ?? channel; // default source = channel name
    const phone = derivePhone(channel, normalized);
    const email = deriveEmail(channel, normalized);

    const result = await query<Lead>(
      `INSERT INTO leads
         (tenant_id, channel, contact_value, name, source, status, segment,
          is_vip, assigned_to, campaign_id, phone, email, last_contacted_at, response_count)
       VALUES ($1, $2, $3, $4, $5, 'new', 'cold',
               COALESCE($6, false), $7, $8, $9, $10, NOW(), 1)
       ON CONFLICT (tenant_id, channel, contact_value) DO UPDATE SET
         name             = COALESCE(EXCLUDED.name, leads.name),
         source           = COALESCE(leads.source, EXCLUDED.source),
         is_vip           = CASE WHEN EXCLUDED.is_vip THEN true ELSE leads.is_vip END,
         assigned_to      = COALESCE(EXCLUDED.assigned_to, leads.assigned_to),
         campaign_id      = COALESCE(EXCLUDED.campaign_id, leads.campaign_id),
         phone            = COALESCE(leads.phone, EXCLUDED.phone),
         email            = COALESCE(leads.email, EXCLUDED.email),
         status           = CASE WHEN leads.status = 'new' THEN 'contacted' ELSE leads.status END,
         response_count   = leads.response_count + 1,
         last_contacted_at = NOW(),
         updated_at       = NOW()
       RETURNING *`,
      [tenantId, channel, normalized, extra?.name ?? null, source,
       extra?.is_vip ?? false, extra?.assigned_to ?? null, extra?.campaign_id ?? null,
       phone, email]
    );

    const lead = result.rows[0];

    // Fire new_lead automation if this was an INSERT (response_count will be 1)
    if (lead.response_count === 1) {
      publishEvent('lead:new', { id: lead.id, channel: lead.channel, source: lead.source, tenant_id: tenantId });
      automationQueue.add('trigger', {
        action: 'evaluate_trigger',
        triggerType: 'new_lead',
        channel,
        data: { lead_id: lead.id, channel, source, tenant_id: tenantId },
      }).catch(() => { /* non-blocking */ });
    }

    return lead;
  }

  // ── List with full filtering ────────────────────────────────────────────

  static async listLeads(opts?: {
    channel?: string; segment?: string; status?: string; tag?: string;
    assigned_to?: string; source?: string; is_vip?: boolean; search?: string;
    limit?: number; offset?: number; tenant_id?: string;
  }): Promise<{ rows: Lead[]; total: number }> {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (opts?.tenant_id) { params.push(opts.tenant_id); conditions.push(`tenant_id = $${params.length}`); }
    if (opts?.channel)    { params.push(opts.channel);   conditions.push(`channel = $${params.length}`); }
    if (opts?.segment)    { params.push(opts.segment);   conditions.push(`segment = $${params.length}`); }
    if (opts?.status)     { params.push(opts.status);    conditions.push(`status = $${params.length}`); }
    if (opts?.source)     { params.push(opts.source);    conditions.push(`source = $${params.length}`); }
    if (opts?.tag)        { params.push(opts.tag);       conditions.push(`$${params.length} = ANY(tags)`); }
    if (opts?.assigned_to){ params.push(opts.assigned_to); conditions.push(`assigned_to = $${params.length}`); }
    if (opts?.is_vip === true) conditions.push('is_vip = true');
    if (opts?.search) {
      params.push(`%${opts.search}%`);
      conditions.push(`(contact_value ILIKE $${params.length} OR COALESCE(name,'') ILIKE $${params.length} OR COALESCE(phone,'') ILIKE $${params.length} OR COALESCE(email,'') ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const baseParams = params.slice();

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*)::int AS count FROM leads ${where}`, baseParams
    );

    params.push(opts?.limit ?? 50);
    params.push(opts?.offset ?? 0);
    const result = await query<Lead>(
      `SELECT * FROM leads ${where}
       ORDER BY is_vip DESC,
         CASE segment WHEN 'hot' THEN 0 WHEN 'warm' THEN 1 ELSE 2 END,
         CASE status  WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'converted' THEN 2 ELSE 3 END,
         last_contacted_at DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { rows: result.rows, total: Number(countResult.rows[0]?.count ?? 0) };
  }

  // ── Get single lead ─────────────────────────────────────────────────────

  static async getLead(id: string, tenantId?: string): Promise<Lead | null> {
    const params: unknown[] = [id];
    let sql = 'SELECT * FROM leads WHERE id = $1';
    if (tenantId) { params.push(tenantId); sql += ` AND tenant_id = $${params.length}`; }
    const result = await query<Lead>(sql, params);
    return result.rows[0] ?? null;
  }

  // ── Get lead by contact value ───────────────────────────────────────────

  static async getLeadByContact(channel: string, contactValue: string, tenantId?: string): Promise<Lead | null> {
    const normalized = normalizeContact(channel, contactValue);
    const tid = tenantId ?? NIL_TENANT;
    const result = await query<Lead>(
      'SELECT * FROM leads WHERE tenant_id = $1 AND channel = $2 AND contact_value = $3 LIMIT 1',
      [tid, channel, normalized]
    );
    return result.rows[0] ?? null;
  }

  // ── Find by phone or email for dedup ────────────────────────────────────

  static async findByPhoneOrEmail(opts: {
    phone?: string; email?: string; tenantId?: string;
  }): Promise<Lead[]> {
    if (!opts.phone && !opts.email) return [];
    const tid = opts.tenantId ?? NIL_TENANT;
    const conditions: string[] = ['tenant_id = $1'];
    const params: unknown[] = [tid];
    const orClauses: string[] = [];
    if (opts.phone) { params.push(opts.phone); orClauses.push(`phone = $${params.length}`); }
    if (opts.email) { params.push(opts.email.toLowerCase()); orClauses.push(`email = $${params.length}`); }
    conditions.push(`(${orClauses.join(' OR ')})`);
    const result = await query<Lead>(
      `SELECT * FROM leads WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC`,
      params
    );
    return result.rows;
  }

  // ── Get full conversation history across all channels ──────────────────

  static async getConversations(leadId: string, tenantId?: string): Promise<{
    threads: Array<{
      id: string; channel: string; status: string; unread_count: number;
      last_message_preview: string | null; last_message_at: Date;
      messages: Array<{ id: string; direction: string; body: string; status: string; created_at: Date }>;
    }>;
  }> {
    const params: unknown[] = [leadId];
    let tidClause = '';
    if (tenantId) { params.push(tenantId); tidClause = ` AND tenant_id = $${params.length}`; }

    const leadResult = await query<{ contact_value: string; channel: string }>(
      `SELECT contact_value, channel FROM leads WHERE id = $1${tidClause}`, params
    );
    const lead = leadResult.rows[0];
    if (!lead) return { threads: [] };

    const threadResult = await query<{
      id: string; channel: string; status: string; unread_count: number;
      last_message_preview: string | null; last_message_at: Date;
    }>(
      `SELECT id, channel, status, unread_count, last_message_preview, last_message_at
       FROM conversation_threads
       WHERE contact_value = $1
       ORDER BY last_message_at DESC
       LIMIT 20`,
      [lead.contact_value]
    );

    const threads = await Promise.all(threadResult.rows.map(async (thread) => {
      const msgResult = await query<{
        id: string; direction: string; body: string; status: string; created_at: Date;
      }>(
        `SELECT id, direction, body, status, created_at
         FROM conversation_messages
         WHERE thread_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [thread.id]
      );
      return { ...thread, messages: msgResult.rows.reverse() };
    }));

    return { threads };
  }

  // ── Dashboard real metrics ──────────────────────────────────────────────

  static async getDashboardStats(tenantId?: string): Promise<{
    total: number; new_today: number; contacted: number; converted: number; lost: number;
    conversion_rate: number; per_channel: Record<string, number>;
    per_source: Record<string, number>; trend_7d: Array<{ date: string; count: number }>;
  }> {
    const tid = tenantId ?? NIL_TENANT;

    const [totalsRow, perChannelRows, perSourceRows, trend7dRows] = await Promise.all([
      query<{ total: string; new_today: string; contacted: string; converted: string; lost: string }>(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS new_today,
           COUNT(*) FILTER (WHERE status = 'contacted')::int AS contacted,
           COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
           COUNT(*) FILTER (WHERE status = 'lost')::int AS lost
         FROM leads WHERE tenant_id = $1`,
        [tid]
      ),
      query<{ channel: string; count: string }>(
        `SELECT channel, COUNT(*)::int AS count FROM leads WHERE tenant_id = $1 GROUP BY channel`,
        [tid]
      ),
      query<{ source: string; count: string }>(
        `SELECT COALESCE(source, 'unknown') AS source, COUNT(*)::int AS count
         FROM leads WHERE tenant_id = $1 GROUP BY source ORDER BY count DESC LIMIT 10`,
        [tid]
      ),
      query<{ date: string; count: string }>(
        `SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
         FROM leads
         WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY created_at::date ORDER BY date ASC`,
        [tid]
      ),
    ]);

    const totals = totalsRow.rows[0] ?? { total: '0', new_today: '0', contacted: '0', converted: '0', lost: '0' };
    const total = Number(totals.total);
    const converted = Number(totals.converted);

    return {
      total,
      new_today: Number(totals.new_today),
      contacted: Number(totals.contacted),
      converted,
      lost: Number(totals.lost),
      conversion_rate: total > 0 ? Math.round((converted / total) * 10000) / 100 : 0,
      per_channel: Object.fromEntries(perChannelRows.rows.map(r => [r.channel, Number(r.count)])),
      per_source: Object.fromEntries(perSourceRows.rows.map(r => [r.source, Number(r.count)])),
      trend_7d: trend7dRows.rows.map(r => ({ date: r.date, count: Number(r.count) })),
    };
  }

  // ── Analytics ──────────────────────────────────────────────────────────

  static async getAnalytics(tenantId?: string): Promise<{
    source_performance: Array<{ source: string; total: number; converted: number; conversion_rate: number }>;
    campaign_performance: Array<{ campaign_id: string; total: number; sent: number; replied: number }>;
    channel_conversion: Array<{ channel: string; total: number; converted: number; conversion_rate: number }>;
  }> {
    const tid = tenantId ?? NIL_TENANT;

    const [sourceRows, campaignRows, channelRows] = await Promise.all([
      query<{ source: string; total: string; converted: string }>(
        `SELECT COALESCE(source,'unknown') AS source,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'converted')::int AS converted
         FROM leads WHERE tenant_id = $1
         GROUP BY source ORDER BY total DESC LIMIT 20`,
        [tid]
      ),
      query<{ campaign_id: string; total: string; sent: string; replied: string }>(
        `SELECT campaign_id,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','replied'))::int AS sent,
                COUNT(*) FILTER (WHERE status = 'replied')::int AS replied
         FROM campaign_leads WHERE tenant_id = $1 AND campaign_id IS NOT NULL
         GROUP BY campaign_id ORDER BY total DESC LIMIT 20`,
        [tid]
      ),
      query<{ channel: string; total: string; converted: string }>(
        `SELECT channel,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'converted')::int AS converted
         FROM leads WHERE tenant_id = $1
         GROUP BY channel ORDER BY total DESC`,
        [tid]
      ),
    ]);

    return {
      source_performance: sourceRows.rows.map(r => ({
        source: r.source, total: Number(r.total), converted: Number(r.converted),
        conversion_rate: Number(r.total) > 0 ? Math.round((Number(r.converted) / Number(r.total)) * 10000) / 100 : 0,
      })),
      campaign_performance: campaignRows.rows.map(r => ({
        campaign_id: r.campaign_id, total: Number(r.total), sent: Number(r.sent), replied: Number(r.replied),
      })),
      channel_conversion: channelRows.rows.map(r => ({
        channel: r.channel, total: Number(r.total), converted: Number(r.converted),
        conversion_rate: Number(r.total) > 0 ? Math.round((Number(r.converted) / Number(r.total)) * 10000) / 100 : 0,
      })),
    };
  }

  // ── Set lifecycle status ────────────────────────────────────────────────

  static async setStatus(
    id: string,
    status: 'new' | 'contacted' | 'converted' | 'lost',
    tenantId?: string
  ): Promise<Lead | null> {
    const params: unknown[] = [id, status];
    let where = 'id = $1';
    if (tenantId) { params.push(tenantId); where += ` AND tenant_id = $${params.length}`; }

    const result = await query<Lead>(
      `UPDATE leads SET status = $2, updated_at = NOW() WHERE ${where} RETURNING *`, params
    );
    const lead = result.rows[0] ?? null;
    if (lead) {
      publishEvent('lead:status_changed', { id: lead.id, channel: lead.channel, status, tenant_id: lead.tenant_id });
      automationQueue.add('trigger', {
        action: 'evaluate_trigger',
        triggerType: 'lead_status_change',
        channel: lead.channel,
        data: { lead_id: lead.id, status, channel: lead.channel, tenant_id: lead.tenant_id },
      }).catch(() => { /* non-blocking */ });
    }
    return lead;
  }

  // ── Track campaign→lead interaction ────────────────────────────────────

  static async trackCampaignLead(
    campaignId: string,
    leadId: string,
    event: 'sent' | 'delivered' | 'opened' | 'replied' | 'failed',
    tenantId?: string,
    errorMsg?: string
  ): Promise<void> {
    const tid = tenantId ?? NIL_TENANT;
    const tsColumn = event === 'sent' ? 'sent_at' : event === 'delivered' ? 'delivered_at'
      : event === 'opened' ? 'opened_at' : event === 'replied' ? 'replied_at' : null;
    const tsInsert = tsColumn ? `${tsColumn},` : '';
    const tsInsertVal = tsColumn ? 'NOW(),' : '';
    const tsUpdate = tsColumn ? `${tsColumn} = NOW(),` : '';
    const errorUpdate = event === 'failed' ? `error_msg = $6,` : '';

    await query(
      `INSERT INTO campaign_leads (campaign_id, lead_id, tenant_id, status, ${tsInsert} error_msg, updated_at)
       VALUES ($1, $2, $3, $4, ${tsInsertVal} $5, NOW())
       ON CONFLICT (campaign_id, lead_id) DO UPDATE SET
         status     = EXCLUDED.status,
         ${tsUpdate}
         ${errorUpdate}
         updated_at = NOW()`,
      [campaignId, leadId, tid, event, errorMsg ?? null]
    );
  }

  // ── Update lead ─────────────────────────────────────────────────────────

  static async updateLead(id: string, data: {
    name?: string; phone?: string; email?: string; source?: string; status?: string;
    segment?: string; tags?: string[]; is_vip?: boolean;
    assigned_to?: string; campaign_id?: string; notes?: string;
    metadata?: Record<string, unknown>;
  }, tenantId?: string): Promise<Lead | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    const fields: [string, unknown][] = [
      ['name', data.name], ['phone', data.phone], ['email', data.email],
      ['source', data.source], ['status', data.status], ['segment', data.segment],
      ['tags', data.tags], ['is_vip', data.is_vip], ['assigned_to', data.assigned_to],
      ['campaign_id', data.campaign_id], ['notes', data.notes],
    ];
    for (const [col, val] of fields) {
      if (val !== undefined) { params.push(val); setClauses.push(`${col} = $${params.length}`); }
    }
    if (data.metadata !== undefined) {
      params.push(JSON.stringify(data.metadata));
      setClauses.push(`metadata = $${params.length}::jsonb`);
    }
    if (params.length === 0) return this.getLead(id, tenantId);

    params.push(id);
    let where = `id = $${params.length}`;
    if (tenantId) { params.push(tenantId); where += ` AND tenant_id = $${params.length}`; }

    const result = await query<Lead>(
      `UPDATE leads SET ${setClauses.join(', ')} WHERE ${where} RETURNING *`, params
    );
    const lead = result.rows[0] ?? null;
    if (lead) publishEvent('lead:updated', { id: lead.id, channel: lead.channel, segment: lead.segment, status: lead.status });
    return lead;
  }

  // ── Tag operations ──────────────────────────────────────────────────────

  static async tagLead(id: string, tags: string[], action: 'add' | 'remove' | 'set' = 'add', tenantId?: string): Promise<Lead | null> {
    const tenantClause = tenantId ? ' AND tenant_id = $3' : '';
    const params: unknown[] = [id, tags];
    if (tenantId) params.push(tenantId);
    let sql: string;
    if (action === 'set') {
      sql = `UPDATE leads SET tags = $2::text[], updated_at = NOW() WHERE id = $1${tenantClause} RETURNING *`;
    } else if (action === 'remove') {
      sql = `UPDATE leads SET tags = ARRAY(SELECT unnest(tags) EXCEPT SELECT unnest($2::text[])), updated_at = NOW() WHERE id = $1${tenantClause} RETURNING *`;
    } else {
      sql = `UPDATE leads SET tags = ARRAY(SELECT DISTINCT unnest(array_cat(tags, $2::text[]))), updated_at = NOW() WHERE id = $1${tenantClause} RETURNING *`;
    }
    const result = await query<Lead>(sql, params);
    const lead = result.rows[0] ?? null;
    if (lead) publishEvent('lead:tagged', { id: lead.id, channel: lead.channel, tags: lead.tags });
    return lead;
  }

  // ── Segment ─────────────────────────────────────────────────────────────

  static async setSegment(id: string, segment: 'hot' | 'warm' | 'cold', tenantId?: string): Promise<Lead | null> {
    const params: unknown[] = [id, segment];
    let where = 'id = $1';
    if (tenantId) { params.push(tenantId); where += ` AND tenant_id = $${params.length}`; }
    const result = await query<Lead>(
      `UPDATE leads SET segment = $2, updated_at = NOW() WHERE ${where} RETURNING *`,
      params
    );
    const lead = result.rows[0] ?? null;
    if (lead) publishEvent('lead:segmented', { id: lead.id, channel: lead.channel, segment });
    return lead;
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  static async getStats(tenantId?: string) {
    const params: unknown[] = [];
    let where = '';
    if (tenantId) { params.push(tenantId); where = `WHERE tenant_id = $${params.length}`; }
    const result = await query<{ channel: string; segment: string; count: string; vip_count: string }>(
      `SELECT channel, segment, COUNT(*)::int as count, COUNT(*) FILTER (WHERE is_vip)::int as vip_count
       FROM leads ${where} GROUP BY channel, segment ORDER BY channel, segment`,
      params
    );
    const stats: Record<string, Record<string, { count: number; vip: number }>> = {};
    for (const row of result.rows) {
      if (!stats[row.channel]) stats[row.channel] = {};
      stats[row.channel][row.segment] = { count: Number(row.count), vip: Number(row.vip_count) };
    }
    return stats;
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  static async deleteLead(id: string, tenantId?: string): Promise<boolean> {
    const params: unknown[] = [id];
    let where = 'id = $1';
    if (tenantId) { params.push(tenantId); where += ` AND tenant_id = $${params.length}`; }
    const result = await query(`DELETE FROM leads WHERE ${where}`, params);
    return (result.rowCount ?? 0) > 0;
  }
}
