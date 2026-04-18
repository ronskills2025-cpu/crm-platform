import { Pool, QueryResultRow } from 'pg';
import { config } from '../../config/src/config';
import { createLogger } from '../../utils/src/logger';

const log = createLogger('db');

let dbAvailable = false;

/**
 * Database Pool Configuration
 * 
 * Supports both standard PostgreSQL and Supabase connections.
 * Supabase uses PostgreSQL, so the same pg Pool works seamlessly.
 * 
 * Connection string formats:
 * - Supabase: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 * - Standard: postgresql://user:password@host:port/database
 */
function createPool(): Pool {
  const connectionString = config.databaseUrl;
  
  if (!connectionString) {
    log.warn('DATABASE_URL not set — pool created but will fail on connect');
    return new Pool();
  }

  // Detect Supabase connection
  const isSupabase = connectionString.includes('supabase.com') || 
                     connectionString.includes('supabase.co');
  
  // Detect Neon connection
  const isNeon = connectionString.includes('neon');

  const poolConfig: any = {
    connectionString,
    max: config.nodeEnv === 'production' ? 50 : 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Cap any single query to 30s — prevents a stuck query from exhausting the pool
    statement_timeout: 30000,
    query_timeout: 30000,
  };

  // SSL configuration for cloud providers
  if (isSupabase || isNeon) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  // Supabase-specific: Use connection pooler settings
  if (isSupabase) {
    // Supabase Transaction pooler has hard connection limits.
    // Stay well below the project limit (free tier default ~60).
    poolConfig.max = config.nodeEnv === 'production' ? 20 : 8;
    poolConfig.idleTimeoutMillis = 10000;
    // PgBouncer in transaction mode doesn't support prepared statements — pg handles this by default
    // but we disable statement caching as an extra safety for transaction pooler
    poolConfig.statement_timeout = 30000;
    log.info('Supabase connection detected — using optimized pool settings');
  }

  return new Pool(poolConfig);
}

export const pool = createPool();

pool.on('error', (err) => {
  log.error('Pool error', err);
  dbAvailable = false;
});

export function isDbAvailable(): boolean {
  return dbAvailable;
}

export async function connectDb(): Promise<boolean> {
  if (!config.databaseUrl) {
    log.warn('DATABASE_URL not set — running without DB');
    return false;
  }
  try {
    const client = await pool.connect();
    client.release();
    dbAvailable = true;
    log.info('Database connected');
    return true;
  } catch (err) {
    log.warn('Database unreachable — running without DB', { error: (err as Error).message });
    dbAvailable = false;
    return false;
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
  if (!dbAvailable) throw new Error('Database unavailable');
  return pool.query<T>(text, params);
}

const ALLOWED_TABLES = new Set([
  // Core
  'messages', 'campaigns', 'leads', 'campaign_leads', 'users', 'tenants', 'provider_configs',
  'templates', 'automation_rules', 'automation_logs', 'scheduled_campaigns',
  'inbox_threads', 'inbox_messages', 'appointments', 'funnels', 'funnel_steps',
  'products', 'reviews', 'surveys', 'survey_responses', 'memberships',
  'events', 'event_attendees', 'catalog_items', 'qr_payments',
  'failed_messages', 'campaign_errors', 'providers', 'conversation_threads', 'conversation_messages',
  // WhatsApp
  'whatsapp_messages', 'whatsapp_webhooks',
  // SMS
  'sms_messages', 'sms_dlt_entities', 'sms_dlt_templates', 'sms_sender_ids',
  'sms_virtual_numbers', 'sms_region_routes', 'sms_analytics_hourly', 'sms_scheduled_jobs',
  // Email
  'email_messages',
  // Telegram
  'telegram_messages',
  // Messenger
  'messenger_messages',
  // Instagram
  'instagram_accounts', 'instagram_messages', 'instagram_comments',
  'instagram_comment_rules', 'instagram_story_rules', 'instagram_leads',
  'instagram_content', 'instagram_automation_logs', 'instagram_lead_bot_configs',
  // WA Chat
  'wa_chat_credentials', 'wa_chat_contacts', 'wa_chat_conversations', 'wa_chat_messages',
]);

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

function validateIdentifier(name: string, label: string): void {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`Invalid ${label}: ${name}`);
  }
}

export async function bulkInsert(
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;
  if (!ALLOWED_TABLES.has(table)) throw new Error(`bulkInsert: disallowed table "${table}"`);
  columns.forEach(c => validateIdentifier(c, 'column'));

  const valuePlaceholders = rows
    .map((_, rowIdx) =>
      `(${columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`).join(', ')})`
    )
    .join(', ');

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valuePlaceholders}`;
  await query(sql, rows.flat());
}

export async function bulkUpdate(
  table: string,
  idColumn: string,
  updates: Array<{ id: string; values: Record<string, unknown> }>
): Promise<void> {
  if (updates.length === 0) return;
  if (!ALLOWED_TABLES.has(table)) throw new Error(`bulkUpdate: disallowed table "${table}"`);
  validateIdentifier(idColumn, 'idColumn');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      const setClauses: string[] = [];
      const params: unknown[] = [u.id];
      let idx = 2;
      for (const [col, val] of Object.entries(u.values)) {
        validateIdentifier(col, 'column');
        setClauses.push(`${col} = $${idx}`);
        params.push(val);
        idx++;
      }
      await client.query(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${idColumn} = $1`, params);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
