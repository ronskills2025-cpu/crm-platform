/**
 * Supabase Client Configuration
 * 
 * This module provides the Supabase client for:
 * - Authentication (if using Supabase Auth)
 * - Realtime subscriptions
 * - Storage
 * - Direct database access via supabase-js
 * 
 * For raw SQL queries, we continue using the pg Pool (connection.ts)
 * since Supabase is PostgreSQL-compatible.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/src/config';
import { createLogger } from '../../utils/src/logger';

const log = createLogger('supabase');

// Get Supabase config from centralized config
const SUPABASE_URL = config.supabase.url;
const SUPABASE_ANON_KEY = config.supabase.anonKey;
const SUPABASE_SERVICE_ROLE_KEY = config.supabase.serviceRoleKey;

let supabaseClient: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

/**
 * Get the Supabase client (anon key - for client-side operations)
 * Use this for operations that respect Row Level Security (RLS)
 */
export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
    });
    log.info('Supabase client initialized');
  }

  return supabaseClient;
}

/**
 * Get the Supabase admin client (service role key - bypasses RLS)
 * Use this for server-side operations that need full database access
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    log.info('Supabase admin client initialized');
  }

  return supabaseAdmin;
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY));
}

/**
 * Get Supabase configuration status
 */
export function getSupabaseStatus(): {
  configured: boolean;
  url: string;
  hasAnonKey: boolean;
  hasServiceKey: boolean;
} {
  return {
    configured: isSupabaseConfigured(),
    url: SUPABASE_URL ? SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0] : '',
    hasAnonKey: !!SUPABASE_ANON_KEY,
    hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
  };
}

export { SupabaseClient };
