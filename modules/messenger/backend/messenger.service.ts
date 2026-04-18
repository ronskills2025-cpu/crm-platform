import { config } from '../../../packages/config/src/config';
import { query, bulkInsert } from '../../../packages/db/src/connection';
import { incrCounter, publishEvent, getRateLimit, todayKey } from '../../../packages/db/src/redis';
import { messengerQueue } from '../../../packages/utils/src/queues';
import { getDynamicProviders, getRateLimitForProvider } from '../../../packages/utils/src/providerConfig.service';
import { v4 as uuid } from 'uuid';

const API_BASE = 'https://graph.facebook.com';

async function resolveProvider(providerName: string): Promise<{
  pageAccessToken: string;
  pageId: string;
  costPerMsg: number;
  ratePerSec: number;
  apiVersion: string;
} | null> {
  // DB-first resolution
  const dbProviders = await getDynamicProviders('messenger');
  const dbMatch = dbProviders.find((p) => p.name === providerName);
  if (dbMatch) {
    const c = dbMatch.credentials as Record<string, string>;
    return {
      pageAccessToken: c.pageAccessToken,
      pageId: c.pageId || '',
      costPerMsg: Number(dbMatch.cost_per_msg),
      ratePerSec: Number(dbMatch.rate_per_sec || config.messenger.ratePerSec),
      apiVersion: c.apiVersion || config.messenger.apiVersion,
    };
  }
  // Static fallback
  const staticMatch = config.messenger.providers.find((p) => p.name === providerName);
  if (staticMatch?.pageAccessToken) {
    return {
      pageAccessToken: staticMatch.pageAccessToken,
      pageId: staticMatch.pageId || '',
      costPerMsg: staticMatch.costPerMsg,
      ratePerSec: config.messenger.ratePerSec,
      apiVersion: config.messenger.apiVersion,
    };
  }
  return null;
}

async function getActiveProviderNames(): Promise<string[]> {
  const dbProviders = await getDynamicProviders('messenger');
  if (dbProviders.length > 0) return dbProviders.map((p) => p.name);
  return config.messenger.providers.map((p) => p.name);
}

export class MessengerService {
  static async getSortedProviders(chain?: string[]): Promise<string[]> {
    return chain?.length ? chain : getActiveProviderNames();
  }

  static async sendViaProvider(
    providerName: string,
    recipientId: string,
    message: string,
    messageType: string = 'text',
    imageUrl?: string,
    buttons?: Array<{ type: string; title: string; url?: string; payload?: string }>,
    quickReplies?: Array<{ content_type: string; title?: string; payload?: string }>,
    tag?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; cost?: number }> {
    const provider = await resolveProvider(providerName);
    if (!provider) {
      return { success: false, error: `Provider ${providerName} not configured` };
    }

    const allowed = await getRateLimit(
      `fb:rate:${providerName}:${Math.floor(Date.now() / 1000)}`,
      await getRateLimitForProvider('messenger', providerName, provider.ratePerSec),
      2
    );
    if (!allowed) return { success: false, error: 'Rate limit exceeded' };

    try {
      const url = `${API_BASE}/${provider.apiVersion}/me/messages?access_token=${provider.pageAccessToken}`;

      // Build the message payload based on type
      let messagePayload: Record<string, unknown>;

      if (messageType === 'image' && imageUrl) {
        messagePayload = {
          attachment: {
            type: 'image',
            payload: { url: imageUrl, is_reusable: true },
          },
        };
      } else if (messageType === 'button_template' && buttons?.length) {
        messagePayload = {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: message,
              buttons: buttons.map((b) => ({
                type: b.type,
                title: b.title,
                ...(b.type === 'web_url' ? { url: b.url } : { payload: b.payload }),
              })),
            },
          },
        };
      } else if (messageType === 'generic_template') {
        messagePayload = {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'generic',
              elements: [{ title: message, ...(imageUrl ? { image_url: imageUrl } : {}), buttons }],
            },
          },
        };
      } else {
        messagePayload = { text: message };
      }

      // Add quick replies if provided
      if (quickReplies?.length) {
        messagePayload.quick_replies = quickReplies.map((qr) => ({
          content_type: qr.content_type || 'text',
          ...(qr.title ? { title: qr.title } : {}),
          ...(qr.payload ? { payload: qr.payload } : {}),
        }));
      }

      const body: Record<string, unknown> = {
        recipient: { id: recipientId },
        message: messagePayload,
        messaging_type: tag ? 'MESSAGE_TAG' : 'RESPONSE',
        ...(tag ? { tag } : {}),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({})) as Record<string, unknown>;
        const fbError = errBody.error as Record<string, unknown> | undefined;
        const errorCode = Number(fbError?.code);

        // 10 = permission denied / user blocked, 551 = this person isn't available right now
        if (errorCode === 10 || errorCode === 551) {
          return { success: false, error: 'User blocked or unavailable' };
        }
        // 4 = rate limit
        if (errorCode === 4 || response.status === 429) {
          return { success: false, error: 'Rate limited by Facebook' };
        }
        // 190 = invalid/expired token
        if (errorCode === 190) {
          return { success: false, error: 'Page access token expired or invalid' };
        }

        return { success: false, error: `FB API ${response.status}: ${fbError?.message || JSON.stringify(errBody)}` };
      }

      const data = (await response.json()) as { message_id?: string; recipient_id?: string };
      return {
        success: true,
        messageId: data.message_id,
        cost: provider.costPerMsg,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Send failed' };
    }
  }

  static async queueBatch(
    campaignId: string,
    contacts: Array<{ recipient_id: string; params?: Record<string, string> }>,
    message: string,
    messageType: string = 'text',
    imageUrl?: string,
    buttons?: unknown,
    quickReplies?: unknown,
    tag?: string,
    providerChain?: string[],
    priority = 0
  ): Promise<{ queued: number }> {
    const chain = await MessengerService.getSortedProviders(providerChain);
    const batchSize = config.messenger.batchSize;
    let queued = 0;

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const rows = batch.map((c) => [
        uuid(), campaignId, c.recipient_id, message,
        messageType, imageUrl || null,
        buttons ? JSON.stringify(buttons) : null,
        quickReplies ? JSON.stringify(quickReplies) : null,
        tag || null, 'queued', 0,
      ]);

      await bulkInsert(
        'messenger_messages',
        ['id', 'campaign_id', 'recipient_id', 'message', 'message_type', 'image_url', 'buttons', 'quick_replies', 'tag', 'status', 'attempts'],
        rows
      );

      await messengerQueue.add(
        'send-batch',
        {
          campaign_id: campaignId,
          messages: batch.map((c, idx) => ({
            id: rows[idx][0],
            recipient_id: c.recipient_id,
            message,
            message_type: messageType,
            image_url: imageUrl,
            buttons,
            quick_replies: quickReplies,
            tag,
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
    await incrCounter(`stats:messenger:queued:${todayKey()}`, 86400);
    publishEvent('messenger:batch_queued', { campaign_id: campaignId, count: queued });
    return { queued };
  }

  static async getCampaignStats(campaignId: string) {
    const result = await query<{ status: string; count: number }>(
      `SELECT status, COUNT(*)::int as count FROM messenger_messages WHERE campaign_id = $1 GROUP BY status`,
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
       FROM messenger_messages WHERE sent_at >= NOW() - $1::interval
       GROUP BY DATE(sent_at), status ORDER BY date DESC`,
      [`${days} days`]
    );
    return result.rows;
  }

  static async getProviderStats() {
    const result = await query(
      `SELECT provider_used, status, COUNT(*)::int as count, COALESCE(SUM(cost),0) as total_cost
       FROM messenger_messages WHERE sent_at >= NOW() - INTERVAL '24 hours'
       GROUP BY provider_used, status`
    );
    return result.rows;
  }

  static async retryFailed(campaignId: string): Promise<number> {
    const result = await query(
      `SELECT id, recipient_id, message, message_type, image_url, buttons, quick_replies, tag
       FROM messenger_messages WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    if (result.rows.length === 0) return 0;

    const chain = await MessengerService.getSortedProviders();
    await messengerQueue.add('retry-batch', {
      campaign_id: campaignId,
      messages: result.rows.map((r: Record<string, unknown>) => ({ ...r, provider_chain: chain })),
    });
    await query(
      `UPDATE messenger_messages SET status = 'queued' WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    return result.rows.length;
  }

  static async replyToUser(
    providerName: string,
    recipientId: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return MessengerService.sendViaProvider(providerName, recipientId, message);
  }

  static async getPageInfo(pageAccessToken: string): Promise<{ ok: boolean; name?: string; id?: string; error?: string }> {
    try {
      const response = await fetch(
        `${API_BASE}/${config.messenger.apiVersion}/me?fields=name,id&access_token=${pageAccessToken}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const data = (await response.json()) as { name?: string; id?: string; error?: Record<string, unknown> };
      if (data.error) return { ok: false, error: String(data.error.message || 'Invalid page token') };
      return { ok: true, name: data.name, id: data.id };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  static async subscribeApp(pageAccessToken: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${API_BASE}/${config.messenger.apiVersion}/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins,messaging_referrals&access_token=${pageAccessToken}`,
        { method: 'POST', signal: AbortSignal.timeout(10000) }
      );
      const data = (await response.json()) as { success?: boolean; error?: Record<string, unknown> };
      if (data.success) return { ok: true };
      return { ok: false, error: String(data.error?.message || 'Failed to subscribe app') };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  }
}
