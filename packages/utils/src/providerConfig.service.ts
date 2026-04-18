/**
 * Dynamic config loader.
 *
 * Workers + services call `getDynamicProviders(channel)` to get the current
 * active provider list from the DB. Results are cached in memory with a short
 * TTL (default 30 s) so that changes made in the admin panel take effect
 * quickly without requiring a restart.
 */

import { query } from '../../db/src/connection';
import { publishEvent } from '../../db/src/redis';
import { createLogger } from './logger';
import type { ProviderConfig } from '../../types/src/ProviderConfig';

export interface ProviderHealthSummary extends ProviderConfig {
  last_message_at: Date | null;
  sent_24h: number;
  failed_24h: number;
  success_rate_24h: number;
  last_error: string | null;
}

const log = createLogger('dynconfig');

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  data: ProviderConfig[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Force-evict the cache for a given channel (called after admin saves). */
export function invalidateProviderCache(channel?: string): void {
  if (channel) {
    cache.delete(channel);
  } else {
    cache.clear();
  }
}

/**
 * Returns active providers for a channel, sorted by priority DESC.
 * Falls back to an empty array if DB is unavailable.
 */
export async function getDynamicProviders(channel: string): Promise<ProviderConfig[]> {
  const cached = cache.get(channel);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const result = await query<ProviderConfig>(
      `SELECT * FROM provider_configs
       WHERE channel = $1 AND is_active = true AND status NOT IN ('paused', 'failed')
       ORDER BY priority DESC, created_at ASC`,
      [channel]
    );
    const data = result.rows;
    cache.set(channel, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    log.warn(`Failed to load providers for ${channel}: ${(err as Error).message}`);
    return cached?.data ?? [];
  }
}

/**
 * Returns a single provider config by id.
 * No caching — used by the admin panel.
 */
export async function getProviderById(id: string): Promise<ProviderConfig | null> {
  const result = await query<ProviderConfig>(
    `SELECT * FROM provider_configs WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

/** Update provider status (connected / failed / paused) and propagate via WS. */
export async function setProviderStatus(
  id: string,
  status: 'connected' | 'failed' | 'unchecked' | 'paused',
  message?: string
): Promise<void> {
  await query(
    `UPDATE provider_configs SET status = $1, status_message = $2, last_validated_at = NOW(), updated_at = NOW() WHERE id = $3`,
    [status, message ?? null, id]
  );

  // Invalidate cache so workers pick up updated status immediately
  const row = await query<{ channel: string; name: string }>(
    `SELECT channel, name FROM provider_configs WHERE id = $1`,
    [id]
  );
  if (row.rows.length) {
    const { channel, name } = row.rows[0];
    invalidateProviderCache(channel);
    publishEvent(`${channel}:provider_status`, { id, name, status, message: message ?? null });
    log.info(`Provider ${name} (${channel}) status → ${status}`);
  }
}

/**
 * Build the provider chain array (names only) for a channel.
 * If a manually-specified chain is provided, it takes precedence.
 * Otherwise returns active providers sorted by priority.
 */
export async function resolveProviderChain(
  channel: string,
  explicitChain?: string[]
): Promise<string[]> {
  if (explicitChain && explicitChain.length > 0) return explicitChain;
  const providers = await getDynamicProviders(channel);
  return providers.map((p) => p.name);
}

export async function getRateLimitForProvider(
  channel: string,
  providerName: string,
  fallbackRate: number
): Promise<number> {
  const providers = await getDynamicProviders(channel);
  const match = providers.find((provider) => provider.name === providerName);
  const configuredRate = Number(match?.rate_per_sec ?? 0);
  return configuredRate > 0 ? configuredRate : fallbackRate;
}

export async function getProviderHealthOverview(channel?: string): Promise<ProviderHealthSummary[]> {
  const params: unknown[] = [];
  const where = channel ? `WHERE p.channel = $1` : '';
  if (channel) params.push(channel);

  const result = await query<ProviderHealthSummary>(
    `WITH message_stats AS (
       SELECT 'whatsapp'::text AS channel,
              provider_used AS name,
              MAX(COALESCE(sent_at, delivered_at, read_at, created_at)) AS last_message_at,
              COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read'))::int AS sent_24h,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_24h,
              MAX(error_message) FILTER (WHERE status = 'failed') AS last_error
       FROM whatsapp_messages
       WHERE provider_used IS NOT NULL AND created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY provider_used

       UNION ALL

       SELECT 'sms'::text AS channel,
              provider_used AS name,
              MAX(COALESCE(sent_at, delivered_at, created_at)) AS last_message_at,
              COUNT(*) FILTER (WHERE status IN ('sent', 'delivered'))::int AS sent_24h,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_24h,
              MAX(error_message) FILTER (WHERE status = 'failed') AS last_error
       FROM sms_messages
       WHERE provider_used IS NOT NULL AND created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY provider_used

       UNION ALL

       SELECT 'email'::text AS channel,
              provider_used AS name,
              MAX(COALESCE(sent_at, delivered_at, opened_at, clicked_at, created_at)) AS last_message_at,
              COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked'))::int AS sent_24h,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_24h,
              MAX(error_message) FILTER (WHERE status = 'failed') AS last_error
       FROM email_messages
       WHERE provider_used IS NOT NULL AND created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY provider_used
     )
     SELECT p.*, s.last_message_at,
            COALESCE(s.sent_24h, 0)::int AS sent_24h,
            COALESCE(s.failed_24h, 0)::int AS failed_24h,
            CASE
              WHEN COALESCE(s.sent_24h, 0) + COALESCE(s.failed_24h, 0) = 0 THEN 100
              ELSE ROUND((COALESCE(s.sent_24h, 0)::numeric * 100.0) / NULLIF(COALESCE(s.sent_24h, 0) + COALESCE(s.failed_24h, 0), 0), 2)
            END AS success_rate_24h,
            s.last_error
     FROM provider_configs p
     LEFT JOIN message_stats s ON s.channel = p.channel AND s.name = p.name
     ${where}
     ORDER BY p.channel, p.priority DESC, p.created_at DESC`,
    params
  );

  return result.rows;
}
