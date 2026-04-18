import { config } from '../../../packages/config/src/config';
import { query, bulkInsert } from '../../../packages/db/src/connection';
import { incrCounter, publishEvent, getRateLimit, todayKey } from '../../../packages/db/src/redis';
import { smsQueue } from '../../../packages/utils/src/queues';
import { getDynamicProviders, getRateLimitForProvider } from '../../../packages/utils/src/providerConfig.service';
import { createSmsProvider } from './sms-providers';
import { v4 as uuid } from 'uuid';

type SmsProviderCreds = Record<string, string | undefined>;

async function resolveSmsProvider(
  providerName: string
): Promise<{ creds: SmsProviderCreds; costPerMsg: number; ratePerSec: number } | null> {
  const dbProviders = await getDynamicProviders('sms');
  const db = dbProviders.find((provider) => provider.name === providerName);
  if (db) {
    return {
      creds: db.credentials as SmsProviderCreds,
      costPerMsg: Number(db.cost_per_msg),
      ratePerSec: Number(db.rate_per_sec || config.sms.ratePerSec),
    };
  }

  const staticMatch = config.sms.providers.find((provider) => provider.name === providerName);
  if (staticMatch) {
    return {
      creds: staticMatch as unknown as SmsProviderCreds,
      costPerMsg: staticMatch.costPerMsg,
      ratePerSec: config.sms.ratePerSec,
    };
  }
  return null;
}

async function getActiveSmsProviderNames(): Promise<string[]> {
  const db = await getDynamicProviders('sms');
  if (db.length > 0) return db.map((p) => p.name);
  return config.sms.providers.map((p) => p.name);
}

/** Resolve a virtual number for non-DLT / unofficial sending */
async function resolveVirtualNumber(
  tenantId: string,
  virtualNumberId?: string,
  region?: string
): Promise<{ phone_number: string; provider_name: string } | null> {
  if (virtualNumberId) {
    const result = await query<{ phone_number: string; provider_name: string }>(
      `SELECT phone_number, provider_name FROM sms_virtual_numbers WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [virtualNumberId, tenantId]
    );
    return result.rows[0] || null;
  }
  // Auto-pick an active virtual number for the region
  const result = await query<{ phone_number: string; provider_name: string }>(
    `SELECT phone_number, provider_name FROM sms_virtual_numbers
     WHERE tenant_id = $1 AND is_active = true ${region ? 'AND region = $2' : ''}
     ORDER BY RANDOM() LIMIT 1`,
    region ? [tenantId, region] : [tenantId]
  );
  return result.rows[0] || null;
}

export class SMSService {
  static async getSortedProviders(chain?: string[]): Promise<string[]> {
    const names = chain?.length ? chain : await getActiveSmsProviderNames();
    return names;
  }

  static async sendViaProvider(
    providerName: string,
    phone: string,
    message: string,
    senderId?: string,
    dltTemplateId?: string,
    useDlt = false
  ): Promise<{ success: boolean; messageId?: string; error?: string; cost?: number }> {
    const resolved = await resolveSmsProvider(providerName);
    if (!resolved) return { success: false, error: `Provider ${providerName} not found` };
    const { creds, costPerMsg, ratePerSec } = resolved;

    const allowed = await getRateLimit(
      `sms:rate:${providerName}:${Math.floor(Date.now() / 1000)}`,
      await getRateLimitForProvider('sms', providerName, ratePerSec),
      2
    );
    if (!allowed) return { success: false, error: 'Rate limit exceeded' };

    const provider = createSmsProvider(providerName, creds, costPerMsg);

    // Only include DLT fields when DLT mode is active
    const dltEntity = useDlt ? (creds.dltEntityId || config.sms.dltEntityId) : undefined;
    const dltTpl = useDlt ? dltTemplateId : undefined;

    return provider.sendSMS({ phone, message, senderId, dltTemplateId: dltTpl, dltEntityId: dltEntity });
  }

  static async queueBatch(
    campaignId: string,
    contacts: Array<{ phone: string; region?: string }>,
    message: string,
    senderId?: string,
    dltTemplateId?: string,
    providerChain?: string[],
    priority = 0,
    useDlt = false,
    virtualNumberId?: string,
    tenantId?: string
  ): Promise<{ queued: number }> {
    const chain = await SMSService.getSortedProviders(providerChain);
    const batchSize = config.sms.batchSize;
    let queued = 0;

    // When not using DLT and a virtual number is available, use it as sender
    let resolvedSenderId = senderId;
    if (!useDlt && tenantId) {
      const vn = await resolveVirtualNumber(tenantId, virtualNumberId, contacts[0]?.region);
      if (vn) {
        resolvedSenderId = resolvedSenderId || vn.phone_number;
      }
    }

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const rows = batch.map((c) => [
        uuid(), campaignId, c.phone, message,
        resolvedSenderId || null, useDlt ? (dltTemplateId || null) : null,
        'queued', 0, c.region || null,
      ]);

      await bulkInsert(
        'sms_messages',
        ['id', 'campaign_id', 'phone', 'message', 'sender_id', 'dlt_template_id', 'status', 'attempts', 'region'],
        rows
      );

      await smsQueue.add(
        'send-batch',
        {
          campaign_id: campaignId,
          messages: batch.map((c, idx) => ({
            id: rows[idx][0],
            phone: c.phone,
            message,
            sender_id: resolvedSenderId,
            dlt_template_id: useDlt ? dltTemplateId : undefined,
            region: c.region,
            provider_chain: chain,
            use_dlt: useDlt,
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
    await incrCounter(`stats:sms:queued:${todayKey()}`, 86400);
    publishEvent('sms:batch_queued', { campaign_id: campaignId, count: queued });
    return { queued };
  }

  static async getCampaignStats(campaignId: string) {
    const result = await query(
      `SELECT status, COUNT(*)::int as count, COALESCE(SUM(cost),0) as total_cost FROM sms_messages WHERE campaign_id = $1 GROUP BY status`,
      [campaignId]
    );
    return result.rows;
  }

  static async getDailyStats(days = 7) {
    const result = await query(
      `SELECT DATE(sent_at) as date, status, COUNT(*)::int as count, COALESCE(SUM(cost),0) as total_cost
       FROM sms_messages WHERE sent_at >= NOW() - $1::interval
       GROUP BY DATE(sent_at), status ORDER BY date DESC`,
      [`${days} days`]
    );
    return result.rows;
  }

  static async getProviderStats() {
    const result = await query(
      `SELECT provider_used, status, COUNT(*)::int as count, COALESCE(SUM(cost),0) as total_cost
       FROM sms_messages WHERE sent_at >= NOW() - INTERVAL '24 hours'
       GROUP BY provider_used, status`
    );
    return result.rows;
  }

  static async retryFailed(campaignId: string): Promise<number> {
    const result = await query(
      `SELECT id, phone, message, sender_id, dlt_template_id, region
       FROM sms_messages WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    if (result.rows.length === 0) return 0;

    const chain = await SMSService.getSortedProviders();
    await smsQueue.add('retry-batch', {
      campaign_id: campaignId,
      messages: result.rows.map((r: Record<string, unknown>) => ({ ...r, provider_chain: chain })),
    });
    await query(
      `UPDATE sms_messages SET status = 'queued' WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    return result.rows.length;
  }
}
