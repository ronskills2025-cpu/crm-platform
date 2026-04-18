import { config } from '../../../packages/config/src/config';
import { query, bulkInsert } from '../../../packages/db/src/connection';
import { incrCounter, publishEvent, getRateLimit, todayKey } from '../../../packages/db/src/redis';
import { whatsappQueue } from '../../../packages/utils/src/queues';
import { getDynamicProviders, getRateLimitForProvider } from '../../../packages/utils/src/providerConfig.service';
import { v4 as uuid } from 'uuid';

const API_BASE = `https://graph.facebook.com/`;

/** Resolve provider config from DB (with env-var fallback). */
async function resolveProvider(providerName: string): Promise<{
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  costPerMsg: number;
  ratePerSec: number;
} | null> {
  // Try DB-managed providers first
  const dbProviders = await getDynamicProviders('whatsapp');
  const dbMatch = dbProviders.find((p) => p.name === providerName);
  if (dbMatch) {
    const c = dbMatch.credentials as Record<string, string>;
    return {
      phoneNumberId: c.phoneNumberId,
      accessToken: c.accessToken,
      apiVersion: c.apiVersion || config.whatsapp.apiVersion,
      costPerMsg: Number(dbMatch.cost_per_msg),
      ratePerSec: Number(dbMatch.rate_per_sec || config.whatsapp.ratePerSec),
    };
  }

  // Fallback: static config (for backwards compatibility)
  const staticProviders = config.whatsapp.providers;
  const staticMatch = staticProviders.find((p) => p.name === providerName);
  if (staticMatch?.phoneNumberId && staticMatch?.accessToken) {
    return {
      phoneNumberId: staticMatch.phoneNumberId,
      accessToken: staticMatch.accessToken,
      apiVersion: config.whatsapp.apiVersion,
      costPerMsg: staticMatch.costPerMsg,
      ratePerSec: config.whatsapp.ratePerSec,
    };
  }

  return null;
}

/** Get all active provider names (DB first, then static fallback). */
async function getActiveProviderNames(): Promise<string[]> {
  const dbProviders = await getDynamicProviders('whatsapp');
  if (dbProviders.length > 0) return dbProviders.map((p) => p.name);
  return config.whatsapp.providers.map((p) => p.name);
}


export class WhatsAppService {
  static async getSortedProviders(chain?: string[]): Promise<string[]> {
    return chain?.length ? chain : getActiveProviderNames();
  }

  static async sendViaProvider(
    providerName: string,
    phone: string,
    message: string,
    templateId?: string,
    templateParams?: string[]
  ): Promise<{ success: boolean; messageId?: string; error?: string; cost?: number }> {
    const provider = await resolveProvider(providerName);
    if (!provider) {
      return { success: false, error: `Provider ${providerName} not configured` };
    }

    const allowed = await getRateLimit(
      `wa:rate:${providerName}:${Math.floor(Date.now() / 1000)}`,
      await getRateLimitForProvider('whatsapp', providerName, provider.ratePerSec),
      2
    );
    if (!allowed) return { success: false, error: 'Rate limit exceeded' };

    const url = `${API_BASE}${provider.apiVersion}/${provider.phoneNumberId}/messages`;

    let body: Record<string, unknown>;
    if (templateId) {
      const components = templateParams?.length
        ? [{ type: 'body', parameters: templateParams.map((v) => ({ type: 'text', text: v })) }]
        : [];
      body = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: { name: templateId, language: { code: 'en' }, components },
      };
    } else {
      body = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.accessToken}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errBody}` };
      }

      const data = (await response.json()) as { messages?: Array<{ id: string }> };
      return { success: true, messageId: data.messages?.[0]?.id, cost: provider.costPerMsg };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Send failed' };
    }
  }

  static async queueBatch(
    campaignId: string,
    contacts: Array<{ phone: string; params?: Record<string, string> }>,
    message: string,
    templateId?: string,
    providerChain?: string[],
    priority = 0
  ): Promise<{ queued: number }> {
    const chain = await WhatsAppService.getSortedProviders(providerChain);
    const batchSize = config.whatsapp.batchSize;
    let queued = 0;

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const rows = batch.map((c) => [
        uuid(), campaignId, c.phone, message, templateId || null,
        JSON.stringify(c.params ? Object.values(c.params) : []), 'queued', 0,
      ]);

      await bulkInsert(
        'whatsapp_messages',
        ['id', 'campaign_id', 'phone', 'message', 'template_id', 'template_params', 'status', 'attempts'],
        rows
      );

      await whatsappQueue.add(
        'send-batch',
        {
          campaign_id: campaignId,
          messages: batch.map((c, idx) => ({
            id: rows[idx][0],
            phone: c.phone,
            message,
            template_id: templateId,
            template_params: c.params ? Object.values(c.params) : [],
            provider_chain: chain,
          })),
        },
        { priority }
      );
      queued += batch.length;
    }

    await query(
      `UPDATE campaigns SET total_contacts = total_contacts + $1, status = 'running', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $2`,
      [queued, campaignId]
    );
    await incrCounter(`stats:whatsapp:queued:${todayKey()}`, 86400);
    publishEvent('whatsapp:batch_queued', { campaign_id: campaignId, count: queued });
    return { queued };
  }

  static async getCampaignStats(campaignId: string) {
    const result = await query<{ status: string; count: number }>(
      `SELECT status, COUNT(*)::int as count FROM whatsapp_messages WHERE campaign_id = $1 GROUP BY status`,
      [campaignId]
    );
    return result.rows.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);
  }

  static async getDailyStats(days = 7) {
    const result = await query(
      `SELECT DATE(sent_at) as date, status, COUNT(*)::int as count
       FROM whatsapp_messages WHERE sent_at >= NOW() - $1::interval
       GROUP BY DATE(sent_at), status ORDER BY date DESC`,
      [`${days} days`]
    );
    return result.rows;
  }

  static async getProviderStats() {
    const result = await query(
      `SELECT provider_used, status, COUNT(*)::int as count, COALESCE(SUM(cost),0) as total_cost
       FROM whatsapp_messages WHERE sent_at >= NOW() - INTERVAL '24 hours'
       GROUP BY provider_used, status`
    );
    return result.rows;
  }

  static async retryFailed(campaignId: string): Promise<number> {
    const result = await query(
      `SELECT id, phone, message, template_id, template_params
       FROM whatsapp_messages WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    if (result.rows.length === 0) return 0;

    const chain = await WhatsAppService.getSortedProviders();
    await whatsappQueue.add('retry-batch', {
      campaign_id: campaignId,
      messages: result.rows.map((r: Record<string, unknown>) => ({ ...r, provider_chain: chain })),
    });
    await query(
      `UPDATE whatsapp_messages SET status = 'queued' WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    return result.rows.length;
  }
}
