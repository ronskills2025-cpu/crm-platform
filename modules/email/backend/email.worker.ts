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
import { EmailService } from './email.service';
import { emailQueue } from '../../../packages/utils/src/queues';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('worker:email');

interface MessageJob {
  id: string;
  to_email: string;
  subject: string;
  html_body?: string;
  text_body?: string;
  provider_chain: string[];
}

interface BatchJobData {
  campaign_id: string;
  messages: MessageJob[];
}

const worker = new Worker<BatchJobData>(
  'email',
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
        'email',
        msg.provider_chain,
        { recipient: msg.to_email, campaign_id, subject: msg.subject, html_body: msg.html_body, text_body: msg.text_body },
        async (provider, payload) =>
          EmailService.sendViaProvider(
            provider,
            payload.recipient as string,
            payload.subject as string,
            payload.html_body as string | undefined,
            payload.text_body as string | undefined
          )
      );

      if (result.success) {
        await query(
          `UPDATE email_messages SET status = 'sent', provider_used = $1, provider_msg_id = $2, cost = $3, sent_at = NOW(), attempts = attempts + 1 WHERE id = $4`,
          [result.providerUsed, result.providerMsgId, result.cost || 0, msg.id]
        );
        sentCount++;
        await incrCounter(`stats:email:sent:${todayKey()}`);
      } else {
        const res = await query<{ attempts: number }>('SELECT attempts FROM email_messages WHERE id = $1', [msg.id]);
        const attemptCount = Number(res.rows[0]?.attempts ?? 0) + 1;
        const needsManualRecovery = isConfigurationError(result.error);

        if (needsManualRecovery || attemptCount >= config.maxRetries) {
          await query(
            `UPDATE email_messages SET status = 'failed', error_message = $1, attempts = $2 WHERE id = $3`,
            [result.error, attemptCount, msg.id]
          );
          await storeFailedMessage('email', campaign_id, msg.id, msg.to_email, msg.subject, msg.provider_chain, result.error || '', attemptCount);
          await logCampaignError({
            campaignId: campaign_id,
            channel: 'email',
            messageId: msg.id,
            recipient: msg.to_email,
            provider: result.providerUsed,
            errorMessage: result.error || 'Send failed',
            retryable: !needsManualRecovery,
            details: { attempts: attemptCount, subject: msg.subject },
          });
          await pauseCampaignForRecovery(
            campaign_id,
            'email',
            needsManualRecovery ? 'Email provider configuration needs attention' : 'Email message failed after retries',
            { provider: result.providerUsed, message_id: msg.id, recipient: msg.to_email }
          );
          failCount++;
          await incrCounter(`stats:email:failed:${todayKey()}`);
          publishEvent('email:message_failed', { campaign_id, message_id: msg.id, recipient: msg.to_email, error: result.error });
        } else {
          const delayMs = Math.min(1000 * 2 ** attemptCount, 60_000);
          await query(
            `UPDATE email_messages SET status = 'queued', error_message = $1, attempts = $2 WHERE id = $3`,
            [result.error, attemptCount, msg.id]
          );
          await emailQueue.add(
            'retry-message',
            { campaign_id, messages: [{ ...msg, provider_chain: msg.provider_chain }] },
            { delay: delayMs, priority: 0 }
          );
          publishEvent('email:retry_scheduled', {
            campaign_id,
            message_id: msg.id,
            recipient: msg.to_email,
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

    if (failCount > 0 && sentCount === 0) {
      const campaign = await query<{ failed_count: number; total_contacts: number }>(
        `SELECT failed_count, total_contacts FROM campaigns WHERE id = $1`,
        [campaign_id]
      );
      const c = campaign.rows[0];
      if (c && c.total_contacts > 0 && c.failed_count / c.total_contacts > 0.5) {
        await query(`UPDATE campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1 AND status = 'running'`, [campaign_id]);
        publishEvent('campaign:paused', { campaign_id, channel: 'email', reason: 'High failure rate' });
      }
    }

    await checkCampaignCompletion(campaign_id);
  },
  { connection: redis, concurrency: config.email.concurrency }
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
    publishEvent('campaign:completed', { campaign_id: campaignId, channel: 'email' });
  }
}

worker.on('failed', (job: Job<BatchJobData> | undefined, err?: Error) => {
  log.error(`Job ${job?.id} failed`, err);
});

log.info('Email worker started');

export default worker;
