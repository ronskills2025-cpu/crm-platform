import { Worker, Job } from 'bullmq';
import { redis } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import { InboxService } from './inbox.service';
import { config } from '../../../packages/config/src/config';
import type { IncomingMessageInput, ReplyMessageInput } from './Inbox';

const log = createLogger('worker:inbox');

interface InboxJobData {
  action: 'incoming' | 'retry-reply' | 'send-reply';
  payload?: IncomingMessageInput;
  threadId?: string;
  messageId?: string;
  reply?: ReplyMessageInput;
}

const worker = new Worker<InboxJobData>(
  'inbox',
  async (job: Job<InboxJobData>) => {
    if (job.data.action === 'incoming' && job.data.payload) {
      await InboxService.receiveIncoming(job.data.payload);
      return;
    }

    if (job.data.action === 'retry-reply' && job.data.messageId) {
      await InboxService.retryReply(job.data.messageId);
      return;
    }

    if (job.data.action === 'send-reply' && job.data.threadId && job.data.reply) {
      await InboxService.sendReply(job.data.threadId, job.data.reply);
    }
  },
  { connection: redis, concurrency: Math.max(5, Math.floor(config.email.concurrency / 2)) }
);

worker.on('failed', (job: Job<InboxJobData> | undefined, err?: Error) => {
  log.error(`Inbox job ${job?.id} failed`, err);
});

log.info('Inbox worker started');

export default worker;
