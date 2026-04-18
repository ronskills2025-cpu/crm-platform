/**
 * @packages/db — Shared database layer
 *
 * Centralizes PostgreSQL pool + Redis connections so every module
 * imports from one place instead of reaching into backend internals.
 * 
 * Supports both standard PostgreSQL and Supabase connections.
 */

export { pool, connectDb, isDbAvailable, query, bulkInsert } from './connection';
export {
  redis,
  redisPub,
  redisSub,
  connectRedis,
  isRedisAvailable,
} from './redis';
export {
  getSupabase,
  getSupabaseAdmin,
  isSupabaseConfigured,
  getSupabaseStatus,
} from './supabase';
