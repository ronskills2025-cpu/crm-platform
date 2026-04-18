import Redis from 'ioredis';
import { config } from '../../config/src/config';
import { createLogger } from '../../utils/src/logger';

const log = createLogger('redis');

let redisAvailable = false;

// Check if Redis is configured
const redisUrl = config.redisUrl;
const redisEnabled = !!(redisUrl && redisUrl.trim() !== '');

// Only create clients if Redis is enabled
let redis: Redis | null = null;
let redisPub: Redis | null = null;
let redisSub: Redis | null = null;

if (redisEnabled) {
  const createClient = (label: string): Redis => {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(times * 1000, 2000);
      },
      reconnectOnError: () => false,
      enableOfflineQueue: false,
    });
    client.on('error', () => {});
    client.on('connect', () => {
      log.debug(`${label} connected`);
      redisAvailable = true;
    });
    client.on('ready', () => { redisAvailable = true; });
    client.on('close', () => { redisAvailable = false; });
    client.on('end', () => { redisAvailable = false; });
    return client;
  };

  redis = createClient('main');
  redisPub = createClient('pub');
  redisSub = createClient('sub');
}

export { redis, redisPub, redisSub };

export async function connectRedis(): Promise<boolean> {
  if (!redisEnabled) {
    log.info('Redis disabled — using in-memory fallback');
    return false;
  }
  
  try {
    await Promise.all([redis!.connect(), redisPub!.connect(), redisSub!.connect()]);
    redisAvailable = true;
    log.info('Redis connected');
    return true;
  } catch {
    log.warn('Redis unavailable — running in degraded mode');
    redisAvailable = false;
    return false;
  }
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function incrCounter(key: string, ttl = 86400): Promise<number> {
  if (!redisAvailable || !redis) return 0;
  const val = await redis.incr(key);
  if (val === 1) await redis.expire(key, ttl);
  return val;
}

export async function getCounter(key: string): Promise<number> {
  if (!redisAvailable || !redis) return 0;
  const val = await redis.get(key);
  return parseInt(val || '0', 10);
}

export async function setWithTTL(key: string, value: string, ttl: number): Promise<void> {
  if (!redisAvailable || !redis) return;
  await redis.set(key, value, 'EX', ttl);
}

export async function getRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  if (!redisAvailable || !redis) return true;
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, windowSec);
  return current <= limit;
}

export function publishEvent(channel: string, data: Record<string, unknown>): void {
  if (!redisAvailable || !redisPub) return;
  redisPub.publish(channel, JSON.stringify({ ...data, timestamp: Date.now() })).catch(() => {});
}

export function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}
