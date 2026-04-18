import { Worker, Job } from 'bullmq';
import { redis, incrCounter, publishEvent, todayKey } from '../../../packages/db/src/redis';
import { query } from '../../../packages/db/src/connection';
import { config } from '../../../packages/config/src/config';
import {
  executeWithFailover,
  storeFailedMessage,
  logCampaignError,
  pauseCampaignForRecovery,
  isConfigurationError,
} from '../../../packages/utils/src/failover';
import { TelegramService } from './telegram.service';
import { telegramQueue } from '../../../packages/utils/src/queues';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('worker:telegram');

interface MessageJob {
  id: string;
  chat_id: string;
  message: string;
  parse_mode?: string;
  photo_url?: string;
  reply_markup?: Record<string, unknown>;
  provider_chain: string[];
}

interface BatchJobData {
  campaign_id: string;
  messages: MessageJob[];
}

const worker = new Worker<BatchJobData>(
  'telegram',
  async (job: Job<BatchJobData>) => {
    const { campaign_id, messages } = job.data;

    const campaignResult = await query('SELECT status FROM campaigns WHERE id = $1', [campaign_id]);
    if (campaignResult.rows[0]?.status === 'paused') {
      throw new Error('Campaign paused');
    }

    let sentCount = 0;
    let failCount = 0;

    for (const msg of messages) {
      const result = await executeWithFailover(
        'telegram',
        msg.provider_chain,
        {
          recipient: msg.chat_id,
          campaign_id,
          message: msg.message,
          parse_mode: msg.parse_mode,
          photo_url: msg.photo_url,
          reply_markup: msg.reply_markup,
        },
        async (provider, payload) =>
          TelegramService.sendViaProvider(
            provider,
            payload.recipient as string,
            payload.message as string,
            payload.parse_mode as string | undefined,
            payload.photo_url as string | undefined,
            payload.reply_markup as Record<string, unknown> | undefined
          )
      );

      if (result.success) {
        await query(
          `UPDATE telegram_messages SET status = 'sent', provider_used = $1, provider_msg_id = $2, cost = $3, sent_at = NOW(), attempts = attempts + 1 WHERE id = $4`,
          [result.providerUsed, result.providerMsgId, result.cost || 0, msg.id]
        );
        sentCount++;
        await incrCounter(`stats:telegram:sent:${todayKey()}`);
      } else {
        // Check if user blocked the bot
        const isBlocked = result.error?.includes('blocked by user') || result.error?.includes('403');
        if (isBlocked) {
          await query(
            `UPDATE telegram_messages SET status = 'blocked', error_message = $1, attempts = attempts + 1 WHERE id = $2`,
            [result.error, msg.id]
          );
          failCount++;
          await incrCounter(`stats:telegram:blocked:${todayKey()}`);
          continue;
        }

        const res = await query<{ attempts: number }>('SELECT attempts FROM telegram_messages WHERE id = $1', [msg.id]);
        const attemptCount = Number(res.rows[0]?.attempts ?? 0) + 1;
        const needsManualRecovery = isConfigurationError(result.error);

        if (needsManualRecovery || attemptCount >= config.maxRetries) {
          await query(
            `UPDATE telegram_messages SET status = 'failed', error_message = $1, attempts = $2 WHERE id = $3`,
            [result.error, attemptCount, msg.id]
          );
          await storeFailedMessage('telegram', campaign_id, msg.id, msg.chat_id, msg.message, msg.provider_chain, result.error || '', attemptCount);
          await logCampaignError({
            campaignId: campaign_id,
            channel: 'telegram',
            messageId: msg.id,
            recipient: msg.chat_id,
            provider: result.providerUsed,
            errorMessage: result.error || 'Send failed',
            retryable: !needsManualRecovery,
            details: { attempts: attemptCount },
          });
          await pauseCampaignForRecovery(
            campaign_id,
            'telegram',
            needsManualRecovery ? 'Telegram provider configuration needs attention' : 'Telegram message failed after retries',
            { provider: result.providerUsed, message_id: msg.id, recipient: msg.chat_id }
          );
          failCount++;
          await incrCounter(`stats:telegram:failed:${todayKey()}`);
          publishEvent('telegram:message_failed', { campaign_id, message_id: msg.id, recipient: msg.chat_id, error: result.error });
        } else {
          const delayMs = Math.min(1000 * 2 ** attemptCount, 60_000);
          await query(
            `UPDATE telegram_messages SET status = 'queued', error_message = $1, attempts = $2 WHERE id = $3`,
            [result.error, attemptCount, msg.id]
          );
          await telegramQueue.add(
            'retry-message',
            { campaign_id, messages: [{ ...msg, provider_chain: msg.provider_chain }] },
            { delay: delayMs, priority: 0 }
          );
          publishEvent('telegram:retry_scheduled', {
            campaign_id,
            message_id: msg.id,
            recipient: msg.chat_id,
            retryInMs: delayMs,
            attempt: attemptCount,
          });
        }
      }
    }

    await query(
      `UPDATE campaigns SET sent_count = sent_count + $1, failed_count = failed_count + $2, updated_at = NOW() WHERE id = $3`,
      [sentCount, failCount, campaign_id]
    );

    // Auto-pause if failure rate too high
    if (failCount > 0 && sentCount === 0) {
      const campaign = await query<{ failed_count: number; total_contacts: number }>(
        `SELECT failed_count, total_contacts FROM campaigns WHERE id = $1`,
        [campaign_id]
      );
      const c = campaign.rows[0];
      if (c && c.total_contacts > 0 && c.failed_count / c.total_contacts > 0.5) {
        await query(`UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1 AND status = 'running'`, [campaign_id]);
        publishEvent('campaign:paused', { campaign_id, channel: 'telegram', reason: 'High failure rate' });
        log.warn(`Campaign ${campaign_id} auto-paused due to high failure rate`);
      }
    }

    await checkCampaignCompletion(campaign_id);
  },
  { connection: redis, concurrency: config.telegram.concurrency }
);

async function checkCampaignCompletion(campaignId: string) {
  const result = await query<{ total_contacts: number; sent_count: number; failed_count: number }>(
    `SELECT total_contacts, sent_count, failed_count FROM campaigns WHERE id = $1`,
    [campaignId]
  );
  const c = result.rows[0];
  if (c && c.sent_count + c.failed_count >= c.total_contacts) {
    await query(
      `UPDATE campaigns SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'running'`,
      [campaignId]
    );
    publishEvent('campaign:completed', { campaign_id: campaignId, channel: 'telegram' });
  }
}

worker.on('failed', (job: Job<BatchJobData> | undefined, err?: Error) => {
  log.error(`Job ${job?.id} failed`, err);
});

log.info('Telegram worker started');

export default worker;
