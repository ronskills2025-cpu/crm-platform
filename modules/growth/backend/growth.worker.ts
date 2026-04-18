import { Worker, Job, Queue } from 'bullmq';
import { redis } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import { query } from '../../../packages/db/src/connection';
import { FollowupService, BroadcastService, GrowthNotificationService } from './growth.service';

const log = createLogger('worker:growth');

type GrowthAction =
  | 'followup_process'
  | 'broadcast_send'
  | 'missed_call_reply'
  | 'review_request_send'
  | 'lead_auto_response'
  | 'cleanup_old_notifications';

interface GrowthJobData {
  action: GrowthAction;
  tenantId?: string;
  data?: Record<string, unknown>;
}

async function processFollowups() {
  const pending = await FollowupService.getPendingActions();

  for (const enrollment of pending) {
    try {
      const steps = enrollment.steps as Array<{ channel: string; template: string; delay_hours: number }> | null;
      if (!steps) continue;
      const step = steps[enrollment.current_step];
      if (!step) {
        // All steps completed
        const nextStep = enrollment.current_step + 1;
        await FollowupService.advanceEnrollment(enrollment.id, nextStep, null);
        continue;
      }
      // Queue the actual message send based on channel
      const growthQueue = new Queue('growth', { connection: redis });
      await growthQueue.add('lead_auto_response', {
        action: 'lead_auto_response',
        tenantId: enrollment.tenant_id,
        data: {
          lead_id: enrollment.lead_id,
          channel: step.channel,
          template: step.template,
          enrollment_id: enrollment.id,
        },
      });
      const nextStep = enrollment.current_step + 1;
      const nextStepDef = steps[nextStep];
      const nextActionAt = nextStepDef
        ? new Date(Date.now() + nextStepDef.delay_hours * 3600000).toISOString()
        : null;
      await FollowupService.advanceEnrollment(enrollment.id, nextStep, nextActionAt);
      log.info(`Advanced enrollment ${enrollment.id} for tenant ${enrollment.tenant_id}`);
    } catch (err) {
      log.error(`Error processing enrollment ${enrollment.id}`, err as Error);
    }
  }
}

async function processBroadcasts() {
  // Find scheduled broadcasts that are due
  const { rows: campaigns } = await query<{ id: string; tenant_id: string; segment_id: string; channel: string; content: unknown }>(
    `SELECT id, tenant_id, segment_id, channel, content FROM broadcast_campaigns
     WHERE status = 'scheduled' AND scheduled_at <= NOW()`
  );

  for (const campaign of campaigns) {
    try {
      await query(`UPDATE broadcast_campaigns SET status = 'sending' WHERE id = $1`, [campaign.id]);
      const contacts = await BroadcastService.computeSegmentContacts(campaign.tenant_id, campaign.segment_id);

      let sent = 0;
      let failed = 0;
      for (const contact of contacts) {
        try {
          // In production, this would queue messages to the appropriate channel worker
          log.info(`Broadcast ${campaign.id}: sending to ${contact.id} via ${campaign.channel}`);
          sent++;
        } catch {
          failed++;
        }
      }

      await query(
        `UPDATE broadcast_campaigns SET status = 'sent', sent_count = $2, failed_count = $3, completed_at = NOW() WHERE id = $1`,
        [campaign.id, sent, failed]
      );

      await GrowthNotificationService.create(
        campaign.tenant_id,
        'broadcast_complete',
        'Broadcast Sent',
        `Campaign sent to ${sent} contacts (${failed} failed)`
      );

      log.info(`Broadcast ${campaign.id} completed: ${sent} sent, ${failed} failed`);
    } catch (err) {
      await query(`UPDATE broadcast_campaigns SET status = 'failed' WHERE id = $1`, [campaign.id]);
      log.error(`Broadcast ${campaign.id} failed`, err as Error);
    }
  }
}

async function sendMissedCallReply(tenantId: string, data: Record<string, unknown>) {
  const { caller_number, config_id } = data;
  const { rows } = await query<{ auto_reply_template: string; response_channel: string }>(
    `SELECT auto_reply_template, response_channel FROM missed_call_configs WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
    [config_id, tenantId]
  );
  if (!rows.length) return;
  const config = rows[0];
  // In production, queue message to whatsapp/sms worker
  log.info(`Missed call auto-reply to ${caller_number} via ${config.response_channel}: ${config.auto_reply_template}`);
}

async function sendReviewRequest(tenantId: string, data: Record<string, unknown>) {
  const { request_id } = data;
  const { rows } = await query<{ id: string; channel: string; customer_phone: string; customer_email: string }>(
    `SELECT rr.id, rc.channel, rr.customer_phone, rr.customer_email
     FROM review_requests rr
     JOIN review_campaigns rc ON rc.id = rr.campaign_id AND rc.tenant_id = rr.tenant_id
     WHERE rr.id = $1 AND rr.tenant_id = $2 AND rr.status = 'pending'`,
    [request_id, tenantId]
  );
  if (!rows.length) return;
  const req = rows[0];
  await query(`UPDATE review_requests SET status = 'sent', sent_at = NOW() WHERE id = $1`, [req.id]);
  log.info(`Review request ${req.id} sent via ${req.channel}`);
}

async function handleLeadAutoResponse(tenantId: string, data: Record<string, unknown>) {
  const { lead_id, channel, template, enrollment_id } = data;
  // In production, dispatch to appropriate channel worker (sms, whatsapp, email)
  log.info(`Auto-response to lead ${lead_id} via ${channel}: ${template} (enrollment: ${enrollment_id})`);
}

async function cleanupOldNotifications() {
  const result = await query(
    `DELETE FROM growth_notifications WHERE created_at < NOW() - INTERVAL '90 days'`
  );
  log.info(`Cleaned up ${result.rowCount} old notifications`);
}

// ── Worker ──
const worker = new Worker<GrowthJobData>(
  'growth',
  async (job: Job<GrowthJobData>) => {
    log.info(`Processing growth job: ${job.data.action}`);
    switch (job.data.action) {
      case 'followup_process':
        await processFollowups();
        break;
      case 'broadcast_send':
        await processBroadcasts();
        break;
      case 'missed_call_reply':
        if (job.data.tenantId && job.data.data) {
          await sendMissedCallReply(job.data.tenantId, job.data.data);
        }
        break;
      case 'review_request_send':
        if (job.data.tenantId && job.data.data) {
          await sendReviewRequest(job.data.tenantId, job.data.data);
        }
        break;
      case 'lead_auto_response':
        if (job.data.tenantId && job.data.data) {
          await handleLeadAutoResponse(job.data.tenantId, job.data.data);
        }
        break;
      case 'cleanup_old_notifications':
        await cleanupOldNotifications();
        break;
      default:
        log.warn(`Unknown growth job action: ${(job.data as GrowthJobData).action}`);
    }
  },
  { connection: redis, concurrency: 5 }
);

worker.on('failed', (job: Job<GrowthJobData> | undefined, err?: Error) => {
  log.error(`Growth job ${job?.id} (${job?.data?.action}) failed`, err);
});

log.info('Growth worker started');

// ── Recurring Jobs ──
async function scheduleRecurringJobs() {
  const growthQueue = new Queue<GrowthJobData>('growth', { connection: redis });

  // Process follow-ups every 60 seconds
  await growthQueue.add('followup_process', { action: 'followup_process' }, {
    repeat: { every: 60_000 },
    jobId: 'recurring:followup_process',
  });

  // Process scheduled broadcasts every 30 seconds
  await growthQueue.add('broadcast_send', { action: 'broadcast_send' }, {
    repeat: { every: 30_000 },
    jobId: 'recurring:broadcast_send',
  });

  // Clean up old notifications daily
  await growthQueue.add('cleanup_old_notifications', { action: 'cleanup_old_notifications' }, {
    repeat: { every: 86_400_000 },
    jobId: 'recurring:cleanup_notifications',
  });

  log.info('Recurring growth jobs scheduled');
}

scheduleRecurringJobs().catch((err) => log.error('Failed to schedule recurring growth jobs', err));

export default worker;
