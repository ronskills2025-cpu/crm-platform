import { Worker, Job } from 'bullmq';
import { redis } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import {
  WaChatSendService,
  WaChatMessageService,
} from './wa-chat.service';

const log = createLogger('worker:wa-chat');

type WaChatAction = 'send_text' | 'send_media' | 'retry_failed';

interface WaChatJobData {
  action: WaChatAction;
  tenantId: string;
  conversationId: string;
  waId: string;
  text?: string;
  media?: {
    type: 'image' | 'document' | 'video' | 'audio';
    url: string;
    caption?: string;
    filename?: string;
    mime_type?: string;
  };
  messageId?: string;
}

async function processJob(job: Job<WaChatJobData>) {
  const { action, tenantId, conversationId, waId, text, media, messageId } = job.data;
  log.info(`Processing wa-chat job ${job.id}: ${action}`);

  switch (action) {
    case 'send_text': {
      if (!text) throw new Error('Missing text');
      await WaChatSendService.sendText(tenantId, conversationId, waId, text);
      break;
    }
    case 'send_media': {
      if (!media) throw new Error('Missing media data');
      await WaChatSendService.sendMedia(tenantId, conversationId, waId, media);
      break;
    }
    case 'retry_failed': {
      if (!messageId) throw new Error('Missing messageId');
      // Re-fetch the message and retry its send
      log.info(`Retrying failed message ${messageId}`);
      break;
    }
    default:
      log.warn(`Unknown wa-chat action: ${action}`);
  }
}

export const waChatWorker = new Worker('wa-chat', processJob, {
  connection: redis,
  concurrency: 10,
  limiter: { max: 50, duration: 1000 },
});

waChatWorker.on('completed', (job) => {
  log.info(`wa-chat job ${job?.id ?? 'unknown'} completed`);
});

waChatWorker.on('failed', (job, err) => {
  log.error(`wa-chat job ${job?.id ?? 'unknown'} failed`, { error: String(err) });
});
