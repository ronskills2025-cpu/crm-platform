import { query } from '../../../packages/db/src/connection';
import { redis, isRedisAvailable, setWithTTL } from '../../../packages/db/src/redis';

const CACHE_TTL = 120; // 2-minute cache for heavy aggregations

// ── Cache helpers ────────────────────────────────────────────────────────────

async function getCached<T>(key: string): Promise<T | null> {
  if (!isRedisAvailable()) return null;
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

async function setCached(key: string, value: unknown): Promise<void> {
  await setWithTTL(key, JSON.stringify(value), CACHE_TTL);
}

// ── Filter types ─────────────────────────────────────────────────────────────

export interface DateFilter {
  from?: string;       // ISO date string — start of window (inclusive)
  to?: string;         // ISO date string — end of window (inclusive)
  channel?: string;    // optional channel filter
  campaign_id?: string;
  tenant_id?: string;
}

function buildDateRange(from?: string, to?: string): { fromDate: Date; toDate: Date } {
  const toDate = to ? new Date(to) : new Date();
  toDate.setHours(23, 59, 59, 999);
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  fromDate.setHours(0, 0, 0, 0);
  return { fromDate, toDate };
}

// ── Analytics Service ────────────────────────────────────────────────────────

export class AnalyticsService {

  // ── Leads ────────────────────────────────────────────────────────────────

  static async aggregateLeads(filters: DateFilter = {}) {
    const { fromDate, toDate } = buildDateRange(filters.from, filters.to);
    const params: unknown[] = [fromDate, toDate];
    const tenantClause = filters.tenant_id
      ? ` AND tenant_id = $${params.push(filters.tenant_id)}`
      : '';

    const [totalsResult, trendResult, byChannelResult] = await Promise.all([
      query<{
        total: string; new_today: string; contacted: string;
        converted: string; lost: string; conversion_rate: string;
      }>(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS new_today,
           COUNT(*) FILTER (WHERE status = 'contacted')::int AS contacted,
           COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
           COUNT(*) FILTER (WHERE status = 'lost')::int AS lost,
           CASE WHEN COUNT(*) > 0
             THEN ROUND(COUNT(*) FILTER (WHERE status = 'converted')::numeric / COUNT(*) * 100, 2)
             ELSE 0 END AS conversion_rate
         FROM leads
         WHERE created_at BETWEEN $1 AND $2${tenantClause}`,
        params
      ),
      query<{ date: string; count: string }>(
        `SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS date,
                COUNT(*)::int AS count
         FROM leads WHERE created_at BETWEEN $1 AND $2${tenantClause}
         GROUP BY created_at::date ORDER BY date ASC`,
        params
      ),
      query<{ channel: string; count: string }>(
        `SELECT channel, COUNT(*)::int AS count
         FROM leads WHERE created_at BETWEEN $1 AND $2${tenantClause}
         GROUP BY channel ORDER BY count DESC`,
        params
      ),
    ]);

    const t = totalsResult.rows[0];
    return {
      total: Number(t?.total ?? 0),
      new_today: Number(t?.new_today ?? 0),
      contacted: Number(t?.contacted ?? 0),
      converted: Number(t?.converted ?? 0),
      lost: Number(t?.lost ?? 0),
      conversion_rate: Number(t?.conversion_rate ?? 0),
      trend: trendResult.rows.map(r => ({ date: r.date, count: Number(r.count) })),
      by_channel: byChannelResult.rows.map(r => ({ channel: r.channel, count: Number(r.count) })),
    };
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────

  static async aggregateCampaigns(filters: DateFilter = {}) {
    const { fromDate, toDate } = buildDateRange(filters.from, filters.to);
    const params: unknown[] = [fromDate, toDate];
    const tenantClause = filters.tenant_id
      ? ` AND tenant_id = $${params.push(filters.tenant_id)}`
      : '';
    const channelClause = filters.channel
      ? ` AND channel = $${params.push(filters.channel)}`
      : '';

    const [summaryResult, topResult, trendResult] = await Promise.all([
      query<{
        total: string; completed: string; running: string;
        total_sent: string; total_delivered: string; total_failed: string; delivery_rate: string;
      }>(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
           COUNT(*) FILTER (WHERE status = 'running')::int AS running,
           COALESCE(SUM(sent_count), 0)::int AS total_sent,
           COALESCE(SUM(delivered_count), 0)::int AS total_delivered,
           COALESCE(SUM(failed_count), 0)::int AS total_failed,
           CASE WHEN COALESCE(SUM(sent_count), 0) > 0
             THEN ROUND(COALESCE(SUM(delivered_count), 0)::numeric / SUM(sent_count) * 100, 2)
             ELSE 0 END AS delivery_rate
         FROM campaigns
         WHERE created_at BETWEEN $1 AND $2${tenantClause}${channelClause}`,
        params
      ),
      query<{
        id: string; name: string; channel: string; status: string;
        sent_count: string; delivered_count: string; failed_count: string; delivery_rate: string;
      }>(
        `SELECT id, name, channel, status, sent_count, delivered_count, failed_count,
           CASE WHEN sent_count > 0
             THEN ROUND(delivered_count::numeric / sent_count * 100, 2) ELSE 0 END AS delivery_rate
         FROM campaigns
         WHERE created_at BETWEEN $1 AND $2${tenantClause}${channelClause}
         ORDER BY sent_count DESC LIMIT 10`,
        params
      ),
      query<{ date: string; sent: string; delivered: string; failed: string }>(
        `SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS date,
                COALESCE(SUM(sent_count), 0)::int AS sent,
                COALESCE(SUM(delivered_count), 0)::int AS delivered,
                COALESCE(SUM(failed_count), 0)::int AS failed
         FROM campaigns
         WHERE created_at BETWEEN $1 AND $2${tenantClause}${channelClause}
         GROUP BY created_at::date ORDER BY date ASC`,
        params
      ),
    ]);

    const s = summaryResult.rows[0];
    return {
      total: Number(s?.total ?? 0),
      completed: Number(s?.completed ?? 0),
      running: Number(s?.running ?? 0),
      total_sent: Number(s?.total_sent ?? 0),
      total_delivered: Number(s?.total_delivered ?? 0),
      total_failed: Number(s?.total_failed ?? 0),
      delivery_rate: Number(s?.delivery_rate ?? 0),
      top_campaigns: topResult.rows.map(r => ({
        id: r.id, name: r.name, channel: r.channel, status: r.status,
        sent_count: Number(r.sent_count),
        delivered_count: Number(r.delivered_count),
        failed_count: Number(r.failed_count),
        delivery_rate: Number(r.delivery_rate),
      })),
      trend: trendResult.rows.map(r => ({
        date: r.date, sent: Number(r.sent), delivered: Number(r.delivered), failed: Number(r.failed),
      })),
    };
  }

  // ── Channels (per-channel message stats) ──────────────────────────────────

  static async aggregateChannels(filters: DateFilter = {}) {
    const { fromDate, toDate } = buildDateRange(filters.from, filters.to);
    const dateParams = [fromDate, toDate];

    const fallback = { rows: [{ sent: '0', delivered: '0', failed: '0', extra: '0', cost: '0' }] };

    const [waResult, smsResult, emailResult, tgResult, msgrResult, igResult] = await Promise.all([
      query<{ sent: string; delivered: string; failed: string; extra: string; cost: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('sent','delivered','read'))::int AS sent,
           COUNT(*) FILTER (WHERE status IN ('delivered','read'))::int AS delivered,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
           COUNT(*) FILTER (WHERE status = 'read')::int AS extra,
           COALESCE(SUM(cost), 0) AS cost
         FROM whatsapp_messages WHERE sent_at BETWEEN $1 AND $2`,
        dateParams
      ).catch(() => fallback),

      query<{ sent: string; delivered: string; failed: string; extra: string; cost: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('sent','delivered'))::int AS sent,
           COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
           0::int AS extra,
           COALESCE(SUM(cost), 0) AS cost
         FROM sms_messages WHERE sent_at BETWEEN $1 AND $2`,
        dateParams
      ).catch(() => fallback),

      query<{ sent: string; delivered: string; failed: string; extra: string; cost: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked'))::int AS sent,
           COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked'))::int AS delivered,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
           COUNT(*) FILTER (WHERE status IN ('opened','clicked'))::int AS extra,
           COALESCE(SUM(cost), 0) AS cost
         FROM email_messages WHERE sent_at BETWEEN $1 AND $2`,
        dateParams
      ).catch(() => fallback),

      query<{ sent: string; delivered: string; failed: string; extra: string; cost: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('sent','delivered'))::int AS sent,
           COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
           0::int AS extra, 0 AS cost
         FROM telegram_messages WHERE sent_at BETWEEN $1 AND $2`,
        dateParams
      ).catch(() => fallback),

      query<{ sent: string; delivered: string; failed: string; extra: string; cost: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('sent','delivered'))::int AS sent,
           COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
           0::int AS extra, 0 AS cost
         FROM messenger_messages WHERE sent_at BETWEEN $1 AND $2`,
        dateParams
      ).catch(() => fallback),

      query<{ sent: string; delivered: string; failed: string; extra: string; cost: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('sent','delivered'))::int AS sent,
           COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
           0::int AS extra, 0 AS cost
         FROM instagram_messages WHERE sent_at BETWEEN $1 AND $2`,
        dateParams
      ).catch(() => fallback),
    ]);

    const raw = [
      { channel: 'whatsapp',  label: 'reads',  row: waResult.rows[0] ?? fallback.rows[0] },
      { channel: 'sms',       label: 'n/a',    row: smsResult.rows[0] ?? fallback.rows[0] },
      { channel: 'email',     label: 'opens',  row: emailResult.rows[0] ?? fallback.rows[0] },
      { channel: 'telegram',  label: 'n/a',    row: tgResult.rows[0] ?? fallback.rows[0] },
      { channel: 'messenger', label: 'n/a',    row: msgrResult.rows[0] ?? fallback.rows[0] },
      { channel: 'instagram', label: 'n/a',    row: igResult.rows[0] ?? fallback.rows[0] },
    ].map(({ channel, label, row }) => {
      const sent      = Number(row.sent ?? 0);
      const delivered = Number(row.delivered ?? 0);
      const failed    = Number(row.failed ?? 0);
      const extra     = Number(row.extra ?? 0);
      const cost      = Number(row.cost ?? 0);
      return {
        channel,
        sent,
        delivered,
        failed,
        extra_label: label,
        extra,
        cost,
        delivery_rate: sent > 0 ? Math.round((delivered / sent) * 10000) / 100 : 0,
      };
    });

    // Optional single-channel filter (applied in memory after all queries)
    const channels = filters.channel
      ? raw.filter(c => c.channel === filters.channel)
      : raw;

    return { channels };
  }

  // ── Revenue ───────────────────────────────────────────────────────────────

  static async aggregateRevenue(filters: DateFilter = {}) {
    const { fromDate, toDate } = buildDateRange(filters.from, filters.to);
    const dateParams = [fromDate, toDate];

    const [qrResult, costResult, trendResult] = await Promise.all([
      query<{ total_revenue: string; payment_count: string; success_count: string }>(
        `SELECT
           COALESCE(SUM(amount), 0) AS total_revenue,
           COUNT(*)::int AS payment_count,
           COUNT(*) FILTER (WHERE status = 'paid')::int AS success_count
         FROM qr_payments WHERE created_at BETWEEN $1 AND $2`,
        dateParams
      ).catch(() => ({ rows: [{ total_revenue: '0', payment_count: '0', success_count: '0' }] })),

      query<{ wa_cost: string; sms_cost: string; email_cost: string }>(
        `SELECT
           COALESCE((SELECT SUM(cost) FROM whatsapp_messages WHERE sent_at BETWEEN $1 AND $2), 0) AS wa_cost,
           COALESCE((SELECT SUM(cost) FROM sms_messages    WHERE sent_at BETWEEN $1 AND $2), 0) AS sms_cost,
           COALESCE((SELECT SUM(cost) FROM email_messages  WHERE sent_at BETWEEN $1 AND $2), 0) AS email_cost`,
        dateParams
      ).catch(() => ({ rows: [{ wa_cost: '0', sms_cost: '0', email_cost: '0' }] })),

      query<{ date: string; revenue: string; payments: string }>(
        `SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS date,
                COALESCE(SUM(amount), 0) AS revenue,
                COUNT(*) FILTER (WHERE status = 'paid')::int AS payments
         FROM qr_payments WHERE created_at BETWEEN $1 AND $2
         GROUP BY created_at::date ORDER BY date ASC`,
        dateParams
      ).catch(() => ({ rows: [] as Array<{ date: string; revenue: string; payments: string }> })),
    ]);

    const qr    = qrResult.rows[0];
    const costs = costResult.rows[0];
    const waC   = Number(costs?.wa_cost ?? 0);
    const smsC  = Number(costs?.sms_cost ?? 0);
    const emlC  = Number(costs?.email_cost ?? 0);

    return {
      total_revenue:      Number(qr?.total_revenue ?? 0),
      payment_count:      Number(qr?.payment_count ?? 0),
      success_count:      Number(qr?.success_count ?? 0),
      total_message_cost: waC + smsC + emlC,
      message_costs:      { whatsapp: waC, sms: smsC, email: emlC },
      trend: trendResult.rows.map(r => ({
        date: r.date, revenue: Number(r.revenue), payments: Number(r.payments),
      })),
    };
  }

  // ── Automation ────────────────────────────────────────────────────────────

  static async aggregateAutomation(filters: DateFilter = {}) {
    const { fromDate, toDate } = buildDateRange(filters.from, filters.to);
    const params: unknown[] = [fromDate, toDate];
    const tenantClause = filters.tenant_id
      ? ` AND tenant_id = $${params.push(filters.tenant_id)}`
      : '';

    const result = await query<{ total: string; succeeded: string; failed: string }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'success')::int AS succeeded,
         COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
       FROM automation_logs
       WHERE created_at BETWEEN $1 AND $2${tenantClause}`,
      params
    ).catch(() => ({ rows: [{ total: '0', succeeded: '0', failed: '0' }] }));

    const r = result.rows[0];
    const total     = Number(r?.total ?? 0);
    const succeeded = Number(r?.succeeded ?? 0);
    const failed    = Number(r?.failed ?? 0);

    return {
      total,
      succeeded,
      failed,
      success_rate: total > 0 ? Math.round((succeeded / total) * 10000) / 100 : 0,
    };
  }

  // ── Combined summary (Redis-cached) ───────────────────────────────────────

  static async getSummary(filters: DateFilter = {}) {
    const cacheKey = `analytics:summary:${JSON.stringify(filters)}`;
    const cached = await getCached<unknown>(cacheKey);
    if (cached) return cached;

    const [leads, campaigns, channels, revenue, automation] = await Promise.all([
      this.aggregateLeads(filters),
      this.aggregateCampaigns(filters),
      this.aggregateChannels(filters),
      this.aggregateRevenue(filters),
      this.aggregateAutomation(filters),
    ]);

    const summary = {
      leads,
      campaigns,
      channels: channels.channels,
      revenue,
      automation,
      generated_at: new Date().toISOString(),
    };

    await setCached(cacheKey, summary);
    return summary;
  }

  // Invalidate all analytics cache entries (call after significant data changes)
  static async invalidateCache(): Promise<void> {
    if (!isRedisAvailable()) return;
    try {
      const keys = await redis.keys('analytics:summary:*');
      if (keys.length > 0) await redis.del(...keys);
    } catch {}
  }
}
