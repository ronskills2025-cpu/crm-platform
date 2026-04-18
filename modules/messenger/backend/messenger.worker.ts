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
import { MessengerService } from './messenger.service';
import { messengerQueue } from '../../../packages/utils/src/queues';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('worker:messenger');

interface MessageJob {
  id: string;
  recipient_id: string;
  message: string;
  message_type?: string;
  image_url?: string;
  buttons?: Array<{ type: string; title: string; url?: string; payload?: string }>;
  quick_replies?: Array<{ content_type: string; title?: string; payload?: string }>;
  tag?: string;
  provider_chain: string[];
}

interface BatchJobData {
  campaign_id: string;
  messages: MessageJob[];
}

const worker = new Worker<BatchJobData>(
  'messenger',
  async (job: Job<BatchJobData>) => {
    const { campaign_id, messages } = job.data;

    const campaignResult = await query('SELECT status FROM campaigns WHERE id = $1', [campaign_id]);
    if (campaignResult.rows[0]?.status === 'paused') throw new Error('Campaign paused');

    let sentCount = 0;
    let failCount = 0;

    for (const msg of messages) {
      const result = await executeWithFailover(
        'messenger',
        msg.provider_chain,
        {
          recipient: msg.recipient_id,
          campaign_id,
          message: msg.message,
          message_type: msg.message_type,
          image_url: msg.image_url,
          buttons: msg.buttons,
          quick_replies: msg.quick_replies,
          tag: msg.tag,
        },
        async (provider, payload) =>
          MessengerService.sendViaProvider(
            provider,
            payload.recipient as string,
            payload.message as string,
            payload.message_type as string | undefined,
            payload.image_url as string | undefined,
            payload.buttons as Array<{ type: string; title: string; url?: string; payload?: string }> | undefined,
            payload.quick_replies as Array<{ content_type: string; title?: string; payload?: string }> | undefined,
            payload.tag as string | undefined
          )
      );

      if (result.success) {
        await query(
          `UPDATE messenger_messages SET status = 'sent', provider_used = $1, provider_msg_id = $2, cost = $3, sent_at = NOW(), attempts = attempts + 1 WHERE id = $4`,
          [result.providerUsed, result.providerMsgId, result.cost || 0, msg.id]
        );
        sentCount++;
        await incrCounter(`stats:messenger:sent:${todayKey()}`);
      } else {
        const isBlocked = result.error?.includes('blocked') || result.error?.includes('unavailable') || result.error?.includes('551');
        if (isBlocked) {
          await query(
            `UPDATE messenger_messages SET status = 'blocked', error_message = $1, attempts = attempts + 1 WHERE id = $2`,
            [result.error, msg.id]
          );
          failCount++;
          await incrCounter(`stats:messenger:blocked:${todayKey()}`);
          continue;
        }

        const res = await query<{ attempts: number }>('SELECT attempts FROM messenger_messages WHERE id = $1', [msg.id]);
        const attemptCount = Number(res.rows[0]?.attempts ?? 0) + 1;
        const needsManualRecovery = isConfigurationError(result.error);

        if (needsManualRecovery || attemptCount >= config.maxRetries) {
          await query(
            `UPDATE messenger_messages SET status = 'failed', error_message = $1, attempts = $2 WHERE id = $3`,
            [result.error, attemptCount, msg.id]
          );
          await storeFailedMessage('messenger', campaign_id, msg.id, msg.recipient_id, msg.message, msg.provider_chain, result.error || '', attemptCount);
          await logCampaignError({
            campaignId: campaign_id,
            channel: 'messenger',
            messageId: msg.id,
            recipient: msg.recipient_id,
            provider: result.providerUsed,
            errorMessage: result.error || 'Send failed',
            retryable: !needsManualRecovery,
            details: { attempts: attemptCount },
          });
          failCount++;
          await incrCounter(`stats:messenger:failed:${todayKey()}`);
          publishEvent('messenger:message_failed', {
            campaign_id,
            recipient: msg.recipient_id,
            error: result.error,
          });

          // Auto-pause campaign if failure rate is too high
          const failRateCheck = await query<{ sent_count: number; failed_count: number }>(
            `SELECT sent_count, failed_count FROM campaigns WHERE id = $1`,
            [campaign_id]
          );
          const c = failRateCheck.rows[0];
          if (c) {
            const total = c.sent_count + c.failed_count + sentCount + failCount;
            const failRate = total > 10 ? ((c.failed_count + failCount) / total) * 100 : 0;
            if (failRate >= config.providerUnhealthyThreshold) {
              await pauseCampaignForRecovery(campaign_id, 'messenger', `Failure rate ${failRate.toFixed(1)}% exceeded threshold`);
            }
          }
        } else {
          const delayMs = Math.min(1000 * 2 ** attemptCount, 60_000);
          await query(
            `UPDATE messenger_messages SET status = 'queued', error_message = $1, attempts = $2 WHERE id = $3`,
            [result.error, attemptCount, msg.id]
          );
          await messengerQueue.add(
            'retry-message',
            { campaign_id, messages: [{ ...msg, provider_chain: msg.provider_chain }] },
            { delay: delayMs, priority: 0 }
          );
          publishEvent('messenger:retry_scheduled', {
            campaign_id,
            message_id: msg.id,
            attempt: attemptCount,
            delay_ms: delayMs,
          });
        }
      }
    }

    await query(
      `UPDATE campaigns SET sent_count = sent_count + $1, failed_count = failed_count + $2, updated_at = NOW() WHERE id = $3`,
      [sentCount, failCount, campaign_id]
    );

    await checkCampaignCompletion(campaign_id);
  },
  {
    connection: redis,
    concurrency: config.messenger.concurrency,
  }
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
    publishEvent('campaign:completed', { campaign_id: campaignId, channel: 'messenger' });
  }
}

worker.on('error', (err) => log.error('Worker error:', err));
worker.on('failed', (job, err) => log.error(`Job ${job?.id} failed: ${err?.message}`));

log.info(`Messenger worker started (concurrency: ${config.messenger.concurrency})`);

export { worker as messengerWorker };
