import { query } from '../../../packages/db/src/connection';

export class SMSAnalyticsService {
  /** Hourly stats for a campaign or provider in a date range */
  static async getHourlyStats(tenantId: string, filters: {
    campaignId?: string;
    provider?: string;
    from?: string;
    to?: string;
    region?: string;
  }) {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;

    if (filters.campaignId) { conditions.push(`campaign_id = $${idx++}`); params.push(filters.campaignId); }
    if (filters.provider) { conditions.push(`provider = $${idx++}`); params.push(filters.provider); }
    if (filters.region) { conditions.push(`region = $${idx++}`); params.push(filters.region); }
    if (filters.from) { conditions.push(`hour >= $${idx++}`); params.push(filters.from); }
    if (filters.to) { conditions.push(`hour <= $${idx++}`); params.push(filters.to); }

    const result = await query(
      `SELECT hour, provider, region, sent, delivered, failed, total_cost
       FROM sms_analytics_hourly WHERE ${conditions.join(' AND ')}
       ORDER BY hour DESC LIMIT 500`,
      params
    );
    return result.rows;
  }

  /** Aggregate campaign-level analytics */
  static async getCampaignAnalytics(tenantId: string, campaignId: string) {
    const result = await query(
      `SELECT
         provider,
         SUM(sent)::int as total_sent,
         SUM(delivered)::int as total_delivered,
         SUM(failed)::int as total_failed,
         SUM(total_cost) as total_cost,
         CASE WHEN SUM(sent) > 0 THEN ROUND(SUM(delivered)::numeric / SUM(sent) * 100, 2) ELSE 0 END as delivery_rate
       FROM sms_analytics_hourly
       WHERE tenant_id = $1 AND campaign_id = $2
       GROUP BY provider`,
      [tenantId, campaignId]
    );
    return result.rows;
  }

  /** Provider performance comparison */
  static async getProviderComparison(tenantId: string, days = 7) {
    const result = await query(
      `SELECT
         provider,
         SUM(sent)::int as total_sent,
         SUM(delivered)::int as total_delivered,
         SUM(failed)::int as total_failed,
         SUM(total_cost) as total_cost,
         CASE WHEN SUM(sent) > 0 THEN ROUND(SUM(delivered)::numeric / SUM(sent) * 100, 2) ELSE 0 END as delivery_rate,
         CASE WHEN SUM(sent) > 0 THEN ROUND(SUM(total_cost) / SUM(sent), 4) ELSE 0 END as cost_per_msg
       FROM sms_analytics_hourly
       WHERE tenant_id = $1 AND hour >= NOW() - $2::interval
       GROUP BY provider
       ORDER BY total_sent DESC`,
      [tenantId, `${days} days`]
    );
    return result.rows;
  }

  /** Regional breakdown */
  static async getRegionalStats(tenantId: string, days = 7) {
    const result = await query(
      `SELECT
         region,
         SUM(sent)::int as total_sent,
         SUM(delivered)::int as total_delivered,
         SUM(failed)::int as total_failed,
         CASE WHEN SUM(sent) > 0 THEN ROUND(SUM(delivered)::numeric / SUM(sent) * 100, 2) ELSE 0 END as delivery_rate
       FROM sms_analytics_hourly
       WHERE tenant_id = $1 AND hour >= NOW() - $2::interval AND region IS NOT NULL
       GROUP BY region
       ORDER BY total_sent DESC`,
      [tenantId, `${days} days`]
    );
    return result.rows;
  }

  /** Cost tracking overview */
  static async getCostOverview(tenantId: string, days = 30) {
    const result = await query(
      `SELECT
         DATE(hour) as date,
         SUM(total_cost) as daily_cost,
         SUM(sent)::int as daily_sent
       FROM sms_analytics_hourly
       WHERE tenant_id = $1 AND hour >= NOW() - $2::interval
       GROUP BY DATE(hour)
       ORDER BY date DESC`,
      [tenantId, `${days} days`]
    );
    return result.rows;
  }

  /**
   * Materialize hourly analytics from sms_messages.
   * Called periodically by a cron job or after campaign completion.
   */
  static async materializeHourly(tenantId: string, campaignId?: string) {
    const filter = campaignId ? `AND campaign_id = $2` : '';
    const params: unknown[] = [tenantId];
    if (campaignId) params.push(campaignId);

    await query(
      `INSERT INTO sms_analytics_hourly (tenant_id, campaign_id, provider, region, hour, sent, delivered, failed, total_cost)
       SELECT
         $1,
         campaign_id,
         COALESCE(provider_used, 'unknown'),
         COALESCE(region, 'unknown'),
         DATE_TRUNC('hour', sent_at),
         COUNT(*) FILTER (WHERE status = 'sent'),
         COUNT(*) FILTER (WHERE status = 'delivered'),
         COUNT(*) FILTER (WHERE status = 'failed'),
         COALESCE(SUM(cost), 0)
       FROM sms_messages
       WHERE tenant_id = $1 AND sent_at IS NOT NULL ${filter}
       GROUP BY campaign_id, COALESCE(provider_used, 'unknown'), COALESCE(region, 'unknown'), DATE_TRUNC('hour', sent_at)
       ON CONFLICT (tenant_id, campaign_id, provider, region, hour)
       DO UPDATE SET
         sent = EXCLUDED.sent,
         delivered = EXCLUDED.delivered,
         failed = EXCLUDED.failed,
         total_cost = EXCLUDED.total_cost`,
      params
    );
  }
}
