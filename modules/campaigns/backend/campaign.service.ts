import { query, isDbAvailable } from '../../../packages/db/src/connection';
import { getCounter, isRedisAvailable, todayKey, publishEvent } from '../../../packages/db/src/redis';
import { getQueueStats, whatsappQueue, smsQueue, emailQueue, telegramQueue, messengerQueue } from '../../../packages/utils/src/queues';

export class CampaignService {
  static async create(data: {
    name: string;
    channel: string;
    message_body?: string;
    subject?: string;
    template_id?: string;
    provider_chain?: string[];
    priority?: number;
    scheduled_at?: string;
    metadata?: Record<string, unknown>;
    tenant_id?: string;
  }) {
    const result = await query(
      `INSERT INTO campaigns (name, channel, message_body, subject, template_id, provider_chain, priority, scheduled_at, metadata, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        data.name, data.channel, data.message_body || null,
        data.subject || null, data.template_id || null,
        data.provider_chain || [], data.priority || 0,
        data.scheduled_at || null, JSON.stringify(data.metadata || {}),
        data.tenant_id || null,
      ]
    );
    return result.rows[0];
  }

  static async getById(id: string, tenantId?: string) {
    const params: unknown[] = [id];
    let sql = 'SELECT * FROM campaigns WHERE id = $1';
    if (tenantId) { params.push(tenantId); sql += ` AND tenant_id = $${params.length}`; }
    const result = await query(sql, params);
    return result.rows[0] || null;
  }

  static async list(channel?: string, status?: string, search?: string, limit = 50, offset = 0, tenantId?: string) {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (tenantId) {
      params.push(tenantId);
      where += ` AND tenant_id = $${params.length}`;
    }
    if (channel) {
      params.push(channel);
      where += ` AND channel = $${params.length}`;
    }
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND name ILIKE $${params.length}`;
    }

    const countParams = [...params];
    params.push(limit, offset);
    const [rows, cnt] = await Promise.all([
      query(`SELECT * FROM campaigns ${where} ORDER BY priority DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params),
      query(`SELECT COUNT(*) AS count FROM campaigns ${where}`, countParams),
    ]);
    return { rows: rows.rows, total: parseInt(cnt.rows[0]?.count ?? '0') };
  }

  static async updateStatus(id: string, status: string) {
    const updates: string[] = ['status = $2', 'updated_at = NOW()'];
    if (status === 'completed') updates.push('completed_at = NOW()');
    if (status === 'running') updates.push('started_at = COALESCE(started_at, NOW())');

    const result = await query(
      `UPDATE campaigns SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      [id, status]
    );

    const campaign = result.rows[0];
    if (campaign) {
      publishEvent('campaign:status_changed', { campaign_id: id, channel: campaign.channel, status });
      if (status === 'paused') {
        publishEvent('campaign:paused', { campaign_id: id, channel: campaign.channel, reason: 'Paused by admin' });
      }
      if (status === 'running') {
        publishEvent('campaign:resumed', { campaign_id: id, channel: campaign.channel });
      }
    }

    return campaign;
  }

  static async pause(id: string) {
    return this.updateStatus(id, 'paused');
  }

  static async resume(id: string) {
    return this.updateStatus(id, 'running');
  }

  static async getGlobalStats() {
    const today = todayKey();
    const promises: Promise<unknown>[] = [];

    if (isDbAvailable()) {
      promises.push(
        query(`
          SELECT channel, status, COUNT(*)::int as count FROM (
            SELECT 'whatsapp' as channel, status FROM whatsapp_messages WHERE created_at >= CURRENT_DATE
            UNION ALL
            SELECT 'sms' as channel, status FROM sms_messages WHERE created_at >= CURRENT_DATE
            UNION ALL
            SELECT 'email' as channel, status FROM email_messages WHERE created_at >= CURRENT_DATE
            UNION ALL
            SELECT 'telegram' as channel, status FROM telegram_messages WHERE created_at >= CURRENT_DATE
            UNION ALL
            SELECT 'messenger' as channel, status FROM messenger_messages WHERE created_at >= CURRENT_DATE
          ) sub GROUP BY channel, status
        `),
        query(`SELECT COUNT(*)::int as count FROM campaigns WHERE status IN ('running', 'paused')`)
      );
    } else {
      promises.push(Promise.resolve({ rows: [] }), Promise.resolve({ rows: [{ count: 0 }] }));
    }

    if (isRedisAvailable()) {
      promises.push(
        getQueueStats(whatsappQueue),
        getQueueStats(smsQueue),
        getQueueStats(emailQueue),
        getQueueStats(telegramQueue),
        getQueueStats(messengerQueue)
      );
    } else {
      const empty = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
      promises.push(Promise.resolve(empty), Promise.resolve(empty), Promise.resolve(empty), Promise.resolve(empty), Promise.resolve(empty));
    }

    const [dbStats, activeCampaigns, waQueue, smsQ, emailQ, tgQueue, msgQueue] = await Promise.all(promises);

    return {
      today,
      messages: (dbStats as { rows: unknown[] }).rows,
      queues: { whatsapp: waQueue, sms: smsQ, email: emailQ, telegram: tgQueue, messenger: msgQueue },
      activeCampaigns: (activeCampaigns as { rows: Array<{ count: number }> }).rows[0]?.count || 0,
    };
  }

  static async getFailedMessages(channel?: string, limit = 100) {
    let sql = 'SELECT * FROM failed_messages WHERE can_retry = true';
    const params: unknown[] = [];

    if (channel) {
      params.push(channel);
      sql += ` AND channel = $${params.length}`;
    }
    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return result.rows;
  }
}
