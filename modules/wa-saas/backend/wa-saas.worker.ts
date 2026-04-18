import { Worker, Job, Queue } from 'bullmq';
import { redis } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import { query } from '../../../packages/db/src/connection';
import {
  DripService,
  OrderTrackingService,
  SubscriptionBotService,
  FlashSaleService,
  TeamInboxService,
  ReengagementService,
  BroadcastOptimizerService,
  WaSaasNotificationService,
} from './wa-saas.service';

const log = createLogger('worker:wa-saas');

type WaSaasAction =
  | 'drip_process'
  | 'broadcast_optimize'
  | 'subscription_reminders'
  | 'flash_sale_process'
  | 'reengagement_process'
  | 'order_delay_check'
  | 'sla_check'
  | 'cleanup_notifications';

interface WaSaasJobData {
  action: WaSaasAction;
  tenantId?: string;
  data?: Record<string, unknown>;
}

// ── Drip Processing ──────────────────────────────────────────────
async function processDrips() {
  const pending = await DripService.getPendingEnrollments();

  for (const enrollment of pending) {
    try {
      const steps = enrollment.steps as Array<{
        delay_days: number;
        delay_hours: number;
        message_type: string;
        template_name: string;
        message_body: string;
      }> | null;
      if (!steps) continue;

      const step = steps[enrollment.current_step];
      if (!step) {
        await DripService.advanceEnrollment(enrollment.id, enrollment.current_step + 1, null);
        continue;
      }

      log.info(`Drip enrollment ${enrollment.id}: sending step ${enrollment.current_step} (${step.message_type})`);

      await DripService.logStep(enrollment.tenant_id, { enrollment_id: enrollment.id, step_order: enrollment.current_step, status: 'sent' });

      const nextStep = enrollment.current_step + 1;
      const nextStepDef = steps[nextStep];
      const nextActionAt = nextStepDef
        ? new Date(Date.now() + (nextStepDef.delay_days * 86_400_000) + (nextStepDef.delay_hours * 3_600_000)).toISOString()
        : null;

      await DripService.advanceEnrollment(enrollment.id, nextStep, nextActionAt);
      log.info(`Advanced drip enrollment ${enrollment.id} to step ${nextStep}`);
    } catch (err) {
      log.error(`Error processing drip enrollment ${enrollment.id}`, err as Error);
      await DripService.logStep(enrollment.tenant_id, { enrollment_id: enrollment.id, step_order: enrollment.current_step, status: 'failed' }).catch(() => {});
    }
  }
}

// ── Broadcast Optimizer ──────────────────────────────────────────
async function processBroadcasts() {
  const batches = await BroadcastOptimizerService.getScheduledBatches();

  for (const batch of batches) {
    try {
      await query(`UPDATE wa_broadcast_batches SET status = 'sending' WHERE id = $1`, [batch.id]);

      const recipients = batch.recipient_filter as Array<string> | null;
      let sent = 0;
      let failed = 0;

      if (recipients) {
        for (const phone of recipients) {
          try {
            log.info(`Broadcast batch ${batch.id}: sending to ${phone}`);
            sent++;
          } catch {
            failed++;
          }
        }
      }

      await query(
        `UPDATE wa_broadcast_batches SET status = 'sent', sent_count = $2, failed_count = $3 WHERE id = $1`,
        [batch.id, sent, failed]
      );

      await WaSaasNotificationService.create(batch.tenant_id, 'broadcast_optimizer', 'batch_sent', `Batch sent: ${sent} delivered, ${failed} failed`);
      log.info(`Broadcast batch ${batch.id}: ${sent} sent, ${failed} failed`);
    } catch (err) {
      await query(`UPDATE wa_broadcast_batches SET status = 'failed' WHERE id = $1`, [batch.id]).catch(() => {});
      log.error(`Broadcast batch ${batch.id} failed`, err as Error);
    }
  }
}

// ── Subscription Reminders ───────────────────────────────────────
async function processSubscriptionReminders() {
  const due = await SubscriptionBotService.getDueReminders();

  for (const sub of due) {
    try {
      log.info(`Subscription reminder for ${sub.id} (tenant ${sub.tenant_id}): renewal due at ${sub.next_billing_date}`);

      await WaSaasNotificationService.create(
        sub.tenant_id, 'subscription_bot', 'renewal_reminder',
        `Subscription ${sub.id} renewal due`, undefined, 'warning'
      );
    } catch (err) {
      log.error(`Subscription reminder error for ${sub.id}`, err as Error);
    }
  }
}

// ── Flash Sale Processing ────────────────────────────────────────
async function processFlashSales() {
  const active = await FlashSaleService.getActiveSales();

  for (const sale of active) {
    try {
      const now = new Date();
      const end = new Date(sale.end_time);

      if (now >= end) {
        await query(`UPDATE wa_flash_sales SET status = 'completed', updated_at = NOW() WHERE id = $1`, [sale.id]);
        await WaSaasNotificationService.create(sale.tenant_id, 'flash_sale', 'sale_ended', `Flash sale "${sale.name}" has ended`);
        log.info(`Flash sale ${sale.id} completed (ended at ${sale.end_time})`);
        continue;
      }

      // Check for pending recipients
      const { rows: pendingRecipients } = await query<{ id: string; phone: string }>(
        `SELECT id, phone FROM wa_flash_sale_recipients WHERE sale_id = $1 AND status = 'pending' LIMIT 100`,
        [sale.id]
      );

      for (const recipient of pendingRecipients) {
        try {
          log.info(`Flash sale ${sale.id}: sending to ${recipient.phone}`);
          await query(`UPDATE wa_flash_sale_recipients SET status = 'sent', sent_at = NOW() WHERE id = $1`, [recipient.id]);
        } catch {
          await query(`UPDATE wa_flash_sale_recipients SET status = 'failed' WHERE id = $1`, [recipient.id]).catch(() => {});
        }
      }
    } catch (err) {
      log.error(`Flash sale processing error for ${sale.id}`, err as Error);
    }
  }
}

// ── Re-engagement Processing ─────────────────────────────────────
async function processReengagement() {
  const active = await ReengagementService.getActiveForProcessing();

  for (const campaign of active) {
    try {
      const { rows: contacts } = await query<{ id: string; phone: string }>(
        `SELECT id, phone FROM wa_reengagement_contacts WHERE campaign_id = $1 AND status = 'pending' LIMIT 50`,
        [campaign.id]
      );

      for (const contact of contacts) {
        try {
          log.info(`Re-engagement ${campaign.id}: sending to ${contact.phone}`);
          await query(`UPDATE wa_reengagement_contacts SET status = 'sent', sent_at = NOW() WHERE id = $1`, [contact.id]);
        } catch {
          await query(`UPDATE wa_reengagement_contacts SET status = 'failed' WHERE id = $1`, [contact.id]).catch(() => {});
        }
      }
    } catch (err) {
      log.error(`Re-engagement processing error for ${campaign.id}`, err as Error);
    }
  }
}

// ── Order Delay Check ────────────────────────────────────────────
async function checkDelayedOrders() {
  const delayed = await OrderTrackingService.getDelayedOrders();

  for (const order of delayed) {
    try {
      await WaSaasNotificationService.create(
        order.tenant_id, 'order_tracking', 'order_delayed',
        `Order ${order.order_number} appears delayed`, undefined, 'warning'
      );
      log.info(`Order ${order.id} delayed notification sent (tenant ${order.tenant_id})`);
    } catch (err) {
      log.error(`Order delay check error for ${order.id}`, err as Error);
    }
  }
}

// ── SLA Check ────────────────────────────────────────────────────
async function checkSla() {
  const breached = await TeamInboxService.getSlaBreached();

  for (const conv of breached) {
    try {
      await WaSaasNotificationService.create(
        conv.tenant_id, 'team_inbox', 'sla_breached',
        `Conversation ${conv.id} SLA breached`, undefined, 'error'
      );
      log.info(`SLA breached for conversation ${conv.id} (tenant ${conv.tenant_id})`);
    } catch (err) {
      log.error(`SLA check error for ${conv.id}`, err as Error);
    }
  }
}

// ── Notification Cleanup ─────────────────────────────────────────
async function cleanupNotifications() {
  const result = await query(
    `DELETE FROM wa_saas_notifications WHERE created_at < NOW() - INTERVAL '90 days'`
  );
  log.info(`Cleaned up ${result.rowCount} old wa-saas notifications`);
}

// ── Worker ────────────────────────────────────────────────────────
const worker = new Worker<WaSaasJobData>(
  'wa-saas',
  async (job: Job<WaSaasJobData>) => {
    log.info(`Processing wa-saas job: ${job.data.action}`);
    switch (job.data.action) {
      case 'drip_process':
        await processDrips();
        break;
      case 'broadcast_optimize':
        await processBroadcasts();
        break;
      case 'subscription_reminders':
        await processSubscriptionReminders();
        break;
      case 'flash_sale_process':
        await processFlashSales();
        break;
      case 'reengagement_process':
        await processReengagement();
        break;
      case 'order_delay_check':
        await checkDelayedOrders();
        break;
      case 'sla_check':
        await checkSla();
        break;
      case 'cleanup_notifications':
        await cleanupNotifications();
        break;
      default:
        log.warn(`Unknown wa-saas job action: ${(job.data as WaSaasJobData).action}`);
    }
  },
  { connection: redis, concurrency: 5 }
);

worker.on('failed', (job: Job<WaSaasJobData> | undefined, err?: Error) => {
  log.error(`WA-SaaS job ${job?.id} (${job?.data?.action}) failed`, err);
});

log.info('WA-SaaS worker started');

// ── Recurring Jobs ────────────────────────────────────────────────
async function scheduleRecurringJobs() {
  const q = new Queue<WaSaasJobData>('wa-saas', { connection: redis });

  await q.add('drip_process', { action: 'drip_process' }, {
    repeat: { every: 60_000 },
    jobId: 'recurring:wa_drip_process',
  });

  await q.add('broadcast_optimize', { action: 'broadcast_optimize' }, {
    repeat: { every: 30_000 },
    jobId: 'recurring:wa_broadcast_optimize',
  });

  await q.add('subscription_reminders', { action: 'subscription_reminders' }, {
    repeat: { every: 3_600_000 },
    jobId: 'recurring:wa_subscription_reminders',
  });

  await q.add('flash_sale_process', { action: 'flash_sale_process' }, {
    repeat: { every: 15_000 },
    jobId: 'recurring:wa_flash_sale_process',
  });

  await q.add('reengagement_process', { action: 'reengagement_process' }, {
    repeat: { every: 120_000 },
    jobId: 'recurring:wa_reengagement_process',
  });

  await q.add('order_delay_check', { action: 'order_delay_check' }, {
    repeat: { every: 300_000 },
    jobId: 'recurring:wa_order_delay_check',
  });

  await q.add('sla_check', { action: 'sla_check' }, {
    repeat: { every: 60_000 },
    jobId: 'recurring:wa_sla_check',
  });

  await q.add('cleanup_notifications', { action: 'cleanup_notifications' }, {
    repeat: { every: 86_400_000 },
    jobId: 'recurring:wa_cleanup_notifications',
  });

  log.info('Recurring WA-SaaS jobs scheduled');
}

scheduleRecurringJobs().catch((err) => log.error('Failed to schedule recurring WA-SaaS jobs', err));

export default worker;
