/**
 * scripts/worker-entry.ts — Unified worker entry point
 *
 * Starts all background workers in a single process for local development.
 * In production, each worker runs in its own container.
 */

import { createLogger } from '../packages/utils/src/logger';
import { connectRedis, isRedisAvailable } from '../packages/db/src/redis';
import { connectDb } from '../packages/db/src/connection';

const log = createLogger('worker-entry');

// Worker modules with hasWorker: true from registry
const WORKER_MODULES = [
  'whatsapp',
  'sms',
  'email',
  'telegram',
  'messenger',
  'instagram',
  'automation',
  'inbox',
  'products',
  'growth',
  'wa-saas',
  'wa-chat',
  'bot-manager',
];

async function startWorkers() {
  log.info('Starting unified worker process...');

  await connectRedis();
  const dbOk = await connectDb();
  if (!dbOk) {
    log.error('Database required for workers. Ensure PostgreSQL is running.');
    process.exit(1);
  }

  if (!isRedisAvailable()) {
    log.error('Redis required for workers. Ensure Redis is running.');
    process.exit(1);
  }

  let loaded = 0;
  for (const mod of WORKER_MODULES) {
    try {
      // Dynamic import of each worker module
      const workerPath = `../modules/${mod}/backend/${mod}.worker`;
      await import(workerPath);
      log.info(`  ✓ ${mod} worker started`);
      loaded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Some modules may not have workers yet — warn and continue
      if (msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND')) {
        log.warn(`  ⊘ ${mod} worker not found (skipped)`);
      } else {
        log.error(`  ✗ ${mod} worker failed: ${msg}`);
      }
    }
  }

  log.info(`Workers ready: ${loaded}/${WORKER_MODULES.length} loaded`);
  log.info('Listening for jobs...');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('Worker shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('Worker shutting down...');
  process.exit(0);
});

startWorkers().catch((err) => {
  log.error('Worker startup failed', err);
  process.exit(1);
});
