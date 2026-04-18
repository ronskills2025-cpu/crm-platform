import { config } from '../../../packages/config/src/config';
import { query, bulkInsert } from '../../../packages/db/src/connection';
import { incrCounter, publishEvent, getRateLimit, todayKey } from '../../../packages/db/src/redis';
import { telegramQueue } from '../../../packages/utils/src/queues';
import { getDynamicProviders, getRateLimitForProvider } from '../../../packages/utils/src/providerConfig.service';
import { v4 as uuid } from 'uuid';

const API_BASE = 'https://api.telegram.org/bot';

/** Resolve provider config from DB (with env-var fallback). */
async function resolveProvider(providerName: string): Promise<{
  botToken: string;
  costPerMsg: number;
  ratePerSec: number;
} | null> {
  // Try DB-managed providers first
  const dbProviders = await getDynamicProviders('telegram');
  const dbMatch = dbProviders.find((p) => p.name === providerName);
  if (dbMatch) {
    const c = dbMatch.credentials as Record<string, string>;
    return {
      botToken: c.botToken,
      costPerMsg: Number(dbMatch.cost_per_msg),
      ratePerSec: Number(dbMatch.rate_per_sec || config.telegram.ratePerSec),
    };
  }

  // Fallback: static config
  const staticProviders = config.telegram.providers;
  const staticMatch = staticProviders.find((p) => p.name === providerName);
  if (staticMatch?.botToken) {
    return {
      botToken: staticMatch.botToken,
      costPerMsg: staticMatch.costPerMsg,
      ratePerSec: config.telegram.ratePerSec,
    };
  }

  return null;
}

/** Get all active provider names (DB first, then static fallback). */
async function getActiveProviderNames(): Promise<string[]> {
  const dbProviders = await getDynamicProviders('telegram');
  if (dbProviders.length > 0) return dbProviders.map((p) => p.name);
  return config.telegram.providers.map((p) => p.name);
}

export class TelegramService {
  static async getSortedProviders(chain?: string[]): Promise<string[]> {
    return chain?.length ? chain : getActiveProviderNames();
  }

  static async sendViaProvider(
    providerName: string,
    chatId: string,
    message: string,
    parseMode?: string,
    photoUrl?: string,
    replyMarkup?: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string; error?: string; cost?: number }> {
    const provider = await resolveProvider(providerName);
    if (!provider) {
      return { success: false, error: `Provider ${providerName} not configured` };
    }

    const allowed = await getRateLimit(
      `tg:rate:${providerName}:${Math.floor(Date.now() / 1000)}`,
      await getRateLimitForProvider('telegram', providerName, provider.ratePerSec),
      2
    );
    if (!allowed) return { success: false, error: 'Rate limit exceeded' };

    try {
      let url: string;
      let body: Record<string, unknown>;

      if (photoUrl) {
        // Send photo with caption
        url = `${API_BASE}${provider.botToken}/sendPhoto`;
        body = {
          chat_id: chatId,
          photo: photoUrl,
          caption: message,
          ...(parseMode && { parse_mode: parseMode }),
          ...(replyMarkup && { reply_markup: replyMarkup }),
        };
      } else {
        // Send text message
        url = `${API_BASE}${provider.botToken}/sendMessage`;
        body = {
          chat_id: chatId,
          text: message,
          ...(parseMode && { parse_mode: parseMode }),
          ...(replyMarkup && { reply_markup: replyMarkup }),
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        // Telegram returns 403 when bot is blocked by user
        if (response.status === 403) {
          return { success: false, error: 'Bot blocked by user' };
        }
        // 429 = rate limited
        if (response.status === 429) {
          return { success: false, error: 'Rate limited by Telegram' };
        }
        return { success: false, error: `HTTP ${response.status}: ${errBody}` };
      }

      const data = (await response.json()) as { ok: boolean; result?: { message_id: number } };
      if (!data.ok) {
        return { success: false, error: 'Telegram API returned ok=false' };
      }
      return {
        success: true,
        messageId: data.result?.message_id?.toString(),
        cost: provider.costPerMsg,
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Send failed' };
    }
  }

  static async queueBatch(
    campaignId: string,
    contacts: Array<{ chat_id: string; params?: Record<string, string> }>,
    message: string,
    parseMode?: string,
    photoUrl?: string,
    replyMarkup?: Record<string, unknown>,
    providerChain?: string[],
    priority = 0
  ): Promise<{ queued: number }> {
    const chain = await TelegramService.getSortedProviders(providerChain);
    const batchSize = config.telegram.batchSize;
    let queued = 0;

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const rows = batch.map((c) => [
        uuid(), campaignId, c.chat_id, message,
        parseMode || null, photoUrl || null,
        replyMarkup ? JSON.stringify(replyMarkup) : null,
        'queued', 0,
      ]);

      await bulkInsert(
        'telegram_messages',
        ['id', 'campaign_id', 'chat_id', 'message', 'parse_mode', 'photo_url', 'reply_markup', 'status', 'attempts'],
        rows
      );

      await telegramQueue.add(
        'send-batch',
        {
          campaign_id: campaignId,
          messages: batch.map((c, idx) => ({
            id: rows[idx][0],
            chat_id: c.chat_id,
            message,
            parse_mode: parseMode,
            photo_url: photoUrl,
            reply_markup: replyMarkup,
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
    await incrCounter(`stats:telegram:queued:${todayKey()}`, 86400);
    publishEvent('telegram:batch_queued', { campaign_id: campaignId, count: queued });
    return { queued };
  }

  static async getCampaignStats(campaignId: string) {
    const result = await query<{ status: string; count: number }>(
      `SELECT status, COUNT(*)::int as count FROM telegram_messages WHERE campaign_id = $1 GROUP BY status`,
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
       FROM telegram_messages WHERE sent_at >= NOW() - $1::interval
       GROUP BY DATE(sent_at), status ORDER BY date DESC`,
      [`${days} days`]
    );
    return result.rows;
  }

  static async getProviderStats() {
    const result = await query(
      `SELECT provider_used, status, COUNT(*)::int as count, COALESCE(SUM(cost),0) as total_cost
       FROM telegram_messages WHERE sent_at >= NOW() - INTERVAL '24 hours'
       GROUP BY provider_used, status`
    );
    return result.rows;
  }

  static async retryFailed(campaignId: string): Promise<number> {
    const result = await query(
      `SELECT id, chat_id, message, parse_mode, photo_url, reply_markup
       FROM telegram_messages WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    if (result.rows.length === 0) return 0;

    const chain = await TelegramService.getSortedProviders();
    await telegramQueue.add('retry-batch', {
      campaign_id: campaignId,
      messages: result.rows.map((r: Record<string, unknown>) => ({ ...r, provider_chain: chain })),
    });
    await query(
      `UPDATE telegram_messages SET status = 'queued' WHERE campaign_id = $1 AND status = 'failed' AND attempts < $2`,
      [campaignId, config.maxRetries]
    );
    return result.rows.length;
  }

  /** Reply to an inbound Telegram message (for inbox). */
  static async replyToChat(
    providerName: string,
    chatId: string,
    message: string,
    parseMode?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return TelegramService.sendViaProvider(providerName, chatId, message, parseMode);
  }

  /** Get bot info to validate token. */
  static async getBotInfo(botToken: string): Promise<{ ok: boolean; username?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE}${botToken}/getMe`, {
        signal: AbortSignal.timeout(10000),
      });
      const data = (await response.json()) as { ok: boolean; result?: { username: string } };
      if (data.ok) {
        return { ok: true, username: data.result?.username };
      }
      return { ok: false, error: 'Invalid bot token' };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  /** Set webhook URL for a bot. */
  static async setWebhook(botToken: string, webhookUrl: string, secretToken?: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const body: Record<string, unknown> = {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      };
      if (secretToken) {
        body.secret_token = secretToken;
      }

      const response = await fetch(`${API_BASE}${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      const data = (await response.json()) as { ok: boolean; description?: string };
      if (data.ok) return { ok: true };
      return { ok: false, error: data.description || 'Failed to set webhook' };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  }
}
