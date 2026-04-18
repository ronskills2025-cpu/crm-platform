/**
 * Bot Manager Worker
 * 
 * Background job processor for bot execution.
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import { BotService } from './bot.service';

const log = createLogger('bot-worker');

interface BotJobData {
  action: 'evaluate_trigger' | 'process_message' | 'scheduled_action';
  trigger_type?: string;
  channel?: string;
  contact_value?: string;
  contact_name?: string;
  message?: string;
  thread_id?: string;
  lead_id?: string;
  metadata?: Record<string, unknown>;
  bot_id?: string;
  conversation_id?: string;
  action_config?: Record<string, unknown>;
}

async function processJob(job: Job<BotJobData>): Promise<void> {
  const { action, ...data } = job.data;

  switch (action) {
    case 'evaluate_trigger': {
      if (!data.trigger_type || !data.channel || !data.contact_value) {
        log.warn('evaluate_trigger missing required fields');
        return;
      }
      await BotService.evaluateTriggers(data.trigger_type, {
        channel: data.channel,
        contact_value: data.contact_value,
        contact_name: data.contact_name,
        message: data.message,
        thread_id: data.thread_id,
        lead_id: data.lead_id,
        metadata: data.metadata,
      });
      break;
    }

    case 'process_message': {
      // Process incoming message through bot system
      if (!data.channel || !data.contact_value || !data.message) {
        log.warn('process_message missing required fields');
        return;
      }
      await BotService.evaluateTriggers('message_received', {
        channel: data.channel,
        contact_value: data.contact_value,
        contact_name: data.contact_name,
        message: data.message,
        thread_id: data.thread_id,
        lead_id: data.lead_id,
        metadata: data.metadata,
      });
      break;
    }

    case 'scheduled_action': {
      // Execute scheduled bot action
      log.info(`Executing scheduled action for bot ${data.bot_id}`);
      break;
    }

    default:
      log.warn(`Unknown bot job action: ${action}`);
  }
}

export function startBotWorker(): Worker {
  const worker = new Worker('bot-manager', processJob, {
    connection: redis,
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000,
    },
  });

  worker.on('completed', (job) => {
    log.debug(`Bot job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    log.error(`Bot job ${job?.id} failed`, err);
  });

  log.info('Bot worker started');
  return worker;
}

export default startBotWorker;
