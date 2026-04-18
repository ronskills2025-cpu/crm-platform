import { query } from '../../db/src/connection';
import { redis, isRedisAvailable, publishEvent, todayKey } from '../../db/src/redis';
import { config } from '../../config/src/config';
import { createLogger } from './logger';

const log = createLogger('failover');

export interface FailoverResult {
  success: boolean;
  providerUsed: string;
  providerMsgId?: string;
  error?: string;
  cost?: number;
}

type SendFunction = (provider: string, payload: Record<string, unknown>) => Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
}>;

export async function executeWithFailover(
  channel: string,
  providerChain: string[],
  payload: Record<string, unknown>,
  sendFn: SendFunction
): Promise<FailoverResult> {
  let lastError = '';

  for (const provider of providerChain) {
    if (isRedisAvailable()) {
      const healthKey = `provider:health:${channel}:${provider}`;
      const health = await redis.get(healthKey);
      if (health === 'unhealthy') {
        lastError = `Provider ${provider} marked unhealthy`;
        continue;
      }
    }

    try {
      const result = await sendFn(provider, payload);

      if (result.success) {
        if (isRedisAvailable()) {
          const key = `provider:success:${channel}:${provider}:${todayKey()}`;
          await redis.incr(key);
          await redis.expire(key, 86400);
        }
        publishEvent(`${channel}:sent`, {
          provider,
          recipient: payload.recipient,
          campaign_id: payload.campaign_id,
        });
        return {
          success: true,
          providerUsed: provider,
          providerMsgId: result.messageId,
          cost: result.cost,
        };
      }

      lastError = result.error || 'Unknown error';
      await trackFailure(channel, provider);
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      await trackFailure(channel, provider);
    }
  }

  publishEvent(`${channel}:failed`, {
    recipient: payload.recipient,
    campaign_id: payload.campaign_id,
    error: lastError,
  });

  return {
    success: false,
    providerUsed: providerChain[providerChain.length - 1] || 'none',
    error: lastError,
  };
}

async function trackFailure(channel: string, provider: string): Promise<void> {
  if (!isRedisAvailable()) return;
  const failKey = `provider:fail:${channel}:${provider}:${todayKey()}`;
  const count = await redis.incr(failKey);
  await redis.expire(failKey, 86400);

  if (count >= config.providerUnhealthyThreshold) {
    await redis.set(
      `provider:health:${channel}:${provider}`,
      'unhealthy',
      'EX',
      config.providerUnhealthyCooldown
    );
    publishEvent(`${channel}:provider_unhealthy`, { provider });
    log.warn(`Provider ${provider} marked unhealthy on ${channel}`);
  }
}

export function isConfigurationError(error?: string): boolean {
  const value = (error || '').toLowerCase();
  return [
    'not configured',
    'unauthorized',
    'forbidden',
    'invalid',
    'authentication',
    'access token',
    'api key',
    'verify token',
    'phone number id',
    'provider not found',
  ].some((token) => value.includes(token));
}

export async function pauseCampaignForRecovery(
  campaignId: string,
  channel: string,
  reason: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const result = await query(
      `UPDATE campaigns
       SET status = 'paused',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = NOW()
       WHERE id = $1 AND status = 'running'
       RETURNING id`,
      [campaignId, JSON.stringify({ pausedReason: reason, pausedAt: new Date().toISOString(), ...details })]
    );

    if (result.rowCount) {
      publishEvent('campaign:paused', {
        campaign_id: campaignId,
        channel,
        reason,
        ...details,
      });
    }
  } catch (err) {
    log.error(`Failed to pause campaign ${campaignId}`, err);
  }
}

export async function logCampaignError(input: {
  campaignId: string;
  channel: string;
  messageId?: string;
  recipient: string;
  provider?: string;
  errorMessage: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO campaign_errors (campaign_id, channel, message_id, recipient, provider, error_message, retryable, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.campaignId,
        input.channel,
        input.messageId ?? null,
        input.recipient,
        input.provider ?? null,
        input.errorMessage,
        input.retryable ?? true,
        JSON.stringify(input.details ?? {}),
      ]
    );

    publishEvent('campaign:error', {
      campaign_id: input.campaignId,
      channel: input.channel,
      recipient: input.recipient,
      provider: input.provider ?? null,
      error: input.errorMessage,
      retryable: input.retryable ?? true,
    });
  } catch (err) {
    log.error('Failed to persist campaign error', err);
  }
}

export async function storeFailedMessage(
  channel: string,
  campaignId: string,
  messageId: string,
  recipient: string,
  messageBody: string,
  providersTried: string[],
  lastError: string,
  attempts: number
): Promise<void> {
  try {
    await query(
      `INSERT INTO failed_messages (channel, campaign_id, message_id, recipient, message_body, providers_tried, last_error, attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [channel, campaignId, messageId, recipient, messageBody, providersTried, lastError, attempts]
    );
  } catch {
    log.error('Failed to store dead-letter message');
  }
}
