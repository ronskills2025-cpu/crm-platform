import { Queue } from 'bullmq';
import { redis, isRedisAvailable } from '../../db/src/redis';

const defaultOpts = {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

// Only create queues if Redis is available
function createQueue(name: string): Queue | null {
  if (!redis) return null;
  return new Queue(name, { connection: redis, ...defaultOpts });
}

export const whatsappQueue = createQueue('whatsapp');
export const smsQueue = createQueue('sms');
export const emailQueue = createQueue('email');
export const inboxQueue = createQueue('inbox');
export const automationQueue = createQueue('automation');
export const cartRecoveryQueue = createQueue('cart-recovery');
export const productQueue = createQueue('product');
export const instagramQueue = createQueue('instagram');
export const growthQueue = createQueue('growth');
export const waSaasQueue = createQueue('wa-saas');
export const telegramQueue = createQueue('telegram');
export const messengerQueue = createQueue('messenger');
export const waChatQueue = createQueue('wa-chat');
export const botManagerQueue = createQueue('bot-manager');

export async function getQueueStats(queue: Queue | null) {
  if (!queue || !isRedisAvailable()) return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
