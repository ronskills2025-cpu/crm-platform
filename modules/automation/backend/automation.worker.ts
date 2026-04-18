import { Worker, Job, Queue } from 'bullmq';
import { redis } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import { AutomationService } from './automation.service';

const log = createLogger('worker:automation');

interface AutomationJobData {
  action: 'run_scheduled' | 'no_reply_check' | 'health_check' | 'cleanup' | 'evaluate_trigger';
  triggerType?: string;
  channel?: string;
  data?: Record<string, unknown>;
}

const worker = new Worker<AutomationJobData>(
  'automation',
  async (job: Job<AutomationJobData>) => {
    switch (job.data.action) {
      case 'run_scheduled':
        await AutomationService.runDueScheduledCampaigns();
        break;
      case 'no_reply_check':
        await AutomationService.detectNoReplies(24);
        break;
      case 'health_check':
        await AutomationService.checkProviderHealth();
        break;
      case 'cleanup':
        await AutomationService.cleanupOldMessages(90);
        break;
      case 'evaluate_trigger':
        if (job.data.triggerType && job.data.channel && job.data.data) {
          await AutomationService.evaluateTrigger(job.data.triggerType, job.data.channel, job.data.data);
        }
        break;
      default:
        log.warn(`Unknown automation job action: ${(job.data as AutomationJobData).action}`);
    }
  },
  { connection: redis, concurrency: 3 }
);

worker.on('failed', (job: Job<AutomationJobData> | undefined, err?: Error) => {
  log.error(`Automation job ${job?.id} (${job?.data?.action}) failed`, err);
});

log.info('Automation worker started');

async function scheduleRecurringJobs() {
  const automationQueue = new Queue<AutomationJobData>('automation', { connection: redis });

  await automationQueue.add('run_scheduled', { action: 'run_scheduled' }, {
    repeat: { every: 60_000 },
    jobId: 'recurring:run_scheduled',
  });

  await automationQueue.add('no_reply_check', { action: 'no_reply_check' }, {
    repeat: { every: 3_600_000 },
    jobId: 'recurring:no_reply_check',
  });

  await automationQueue.add('health_check', { action: 'health_check' }, {
    repeat: { every: 300_000 },
    jobId: 'recurring:health_check',
  });

  await automationQueue.add('cleanup', { action: 'cleanup' }, {
    repeat: { every: 86_400_000 },
    jobId: 'recurring:cleanup',
  });

  log.info('Recurring automation jobs scheduled');
}

scheduleRecurringJobs().catch((err) => log.error('Failed to schedule recurring jobs', err));

export default worker;
