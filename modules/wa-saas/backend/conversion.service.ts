import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('service:conversion');

export interface Conversion {
  id: string;
  tenant_id: string | null;
  campaign_id: string | null;
  cart_session_id: string | null;
  lead_id: string | null;
  channel: string;
  contact_value: string;
  conversion_type: string;
  order_id: string | null;
  order_value: number | null;
  currency: string;
  attributed_message_id: string | null;
  metadata: Record<string, unknown>;
  converted_at: string;
  created_at: string;
}

export class ConversionService {
  static async track(data: {
    tenantId: string | null;
    channel: string;
    contactValue: string;
    conversionType?: string;
    orderId?: string;
    orderValue?: number;
    currency?: string;
    campaignId?: string;
    cartSessionId?: string;
    leadId?: string;
    attributedMessageId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Conversion> {
    const res = await query<Conversion>(
      `INSERT INTO conversions
         (tenant_id, channel, contact_value, conversion_type, order_id, order_value,
          currency, campaign_id, cart_session_id, lead_id, attributed_message_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        data.tenantId ?? null,
        data.channel,
        data.contactValue,
        data.conversionType ?? 'purchase',
        data.orderId ?? null,
        data.orderValue ?? null,
        data.currency ?? 'INR',
        data.campaignId ?? null,
        data.cartSessionId ?? null,
        data.leadId ?? null,
        data.attributedMessageId ?? null,
        JSON.stringify(data.metadata ?? {}),
      ]
    );
    return res.rows[0];
  }

  static async list(tenantId: string | null, params?: {
    channel?: string;
    type?: string;
    campaignId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ conversions: Conversion[]; total: number }> {
    const clauses: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (tenantId) { clauses.push(`tenant_id = $${i++}`); vals.push(tenantId); }
    if (params?.channel) { clauses.push(`channel = $${i++}`); vals.push(params.channel); }
    if (params?.type) { clauses.push(`conversion_type = $${i++}`); vals.push(params.type); }
    if (params?.campaignId) { clauses.push(`campaign_id = $${i++}`); vals.push(params.campaignId); }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const [rows, count] = await Promise.all([
      query<Conversion>(
        `SELECT * FROM conversions ${where} ORDER BY converted_at DESC LIMIT $${i++} OFFSET $${i++}`,
        [...vals, limit, offset]
      ),
      query<{ count: string }>(`SELECT COUNT(*) AS count FROM conversions ${where}`, vals),
    ]);

    return { conversions: rows.rows, total: parseInt(count.rows[0]?.count ?? '0') };
  }

  static async getCampaignROI(tenantId: string | null, campaignId: string) {
    const params: unknown[] = [campaignId];
    let where = `WHERE campaign_id = $1`;
    if (tenantId) { where += ` AND tenant_id = $2`; params.push(tenantId); }

    const res = await query<{
      count: string;
      total_value: string;
      avg_value: string;
    }>(
      `SELECT COUNT(*) AS count, COALESCE(SUM(order_value),0) AS total_value,
              COALESCE(AVG(order_value),0) AS avg_value
       FROM conversions ${where}`,
      params
    );

    return {
      conversions: parseInt(res.rows[0]?.count ?? '0'),
      totalRevenue: parseFloat(res.rows[0]?.total_value ?? '0'),
      avgOrderValue: parseFloat(res.rows[0]?.avg_value ?? '0'),
    };
  }

  static async getStats(tenantId: string | null, days = 30) {
    const params: unknown[] = [days];
    let where = `WHERE converted_at > NOW() - ($1 || ' days')::INTERVAL`;
    if (tenantId) { where += ` AND tenant_id = $2`; params.push(tenantId); }

    const res = await query<{
      total: string;
      total_value: string;
      channel: string;
      cx: string;
    }>(
      `SELECT channel, COUNT(*) AS cx, COALESCE(SUM(order_value),0) AS total_value
       FROM conversions ${where}
       GROUP BY channel`,
      params
    );

    const byChannel: Record<string, { count: number; revenue: number }> = {};
    let totalRevenue = 0;
    let totalConversions = 0;

    for (const row of res.rows) {
      byChannel[row.channel] = {
        count: parseInt(row.cx),
        revenue: parseFloat(row.total_value),
      };
      totalConversions += parseInt(row.cx);
      totalRevenue += parseFloat(row.total_value);
    }

    return { totalConversions, totalRevenue, byChannel, period: days };
  }
}
