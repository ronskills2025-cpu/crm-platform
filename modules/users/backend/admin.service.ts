/**
 * Admin service — CRUD, validation, and Meta webhook registration for provider configs.
 */

import { query } from '../../../packages/db/src/connection';
import { publishEvent } from '../../../packages/db/src/redis';
import { createLogger } from '../../../packages/utils/src/logger';
import {
  invalidateProviderCache,
  setProviderStatus,
  getProviderById,
} from '../../../packages/utils/src/providerConfig.service';
import {
  WhatsAppCredentialsSchema,
  SmsCredentialsSchema,
  EmailCredentialsSchema,
} from '../../../packages/types/src/ProviderConfig';
import type { ProviderConfig } from '../../../packages/types/src/ProviderConfig';
import nodemailer from 'nodemailer';

const log = createLogger('admin:provider');

function normalizeCredentials(
  channel: string,
  credentials: Record<string, unknown>,
  fallbackName: string
): Record<string, unknown> {
  if (channel === 'whatsapp') {
    return WhatsAppCredentialsSchema.parse(credentials);
  }

  if (channel === 'sms') {
    const provider = typeof credentials.provider === 'string'
      ? credentials.provider
      : ['fast2sms', 'msg91', 'textlocal'].includes(fallbackName)
        ? fallbackName
        : 'custom';
    return SmsCredentialsSchema.parse({ ...credentials, provider });
  }

  const provider = typeof credentials.provider === 'string'
    ? credentials.provider
    : ['resend', 'sendgrid', 'smtp'].includes(fallbackName)
      ? fallbackName
      : 'smtp';
  return EmailCredentialsSchema.parse({ ...credentials, provider });
}

function mergeCredentialPatch(
  current: Record<string, unknown>,
  patch?: Record<string, unknown>
): Record<string, unknown> {
  if (!patch) return current;

  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Empty or masked strings mean "keep existing secret"
      if (trimmed === '' || trimmed.includes('***')) {
        continue;
      }
      merged[key] = trimmed;
      continue;
    }

    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

async function syncWhatsAppWebhook(provider: ProviderConfig): Promise<void> {
  if (provider.channel !== 'whatsapp') return;

  const creds = provider.credentials as Record<string, string>;
  if (!creds.webhookUrl || !creds.verifyToken || !creds.phoneNumberId || !creds.accessToken) {
    return;
  }

  const webhookResult = await registerWhatsAppWebhook(
    creds.phoneNumberId,
    creds.accessToken,
    creds.webhookUrl,
    creds.verifyToken,
    creds.apiVersion || 'v21.0'
  );

  await query(
    `INSERT INTO whatsapp_webhooks
       (provider_config_id, phone_number_id, webhook_url, verify_token, is_registered, registered_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 THEN NOW() ELSE NULL END, NOW())
     ON CONFLICT (phone_number_id) DO UPDATE SET
       webhook_url = EXCLUDED.webhook_url,
       verify_token = EXCLUDED.verify_token,
       is_registered = EXCLUDED.is_registered,
       registered_at = CASE WHEN EXCLUDED.is_registered THEN NOW() ELSE whatsapp_webhooks.registered_at END,
       updated_at = NOW()`,
    [provider.id, creds.phoneNumberId, creds.webhookUrl, creds.verifyToken, webhookResult.success]
  );

  if (!webhookResult.success) {
    await setProviderStatus(provider.id, 'failed', webhookResult.error ?? 'Webhook registration failed');
  }
}

async function resumePausedCampaignsForChannel(channel: string): Promise<void> {
  const messageTable = `${channel}_messages`;
  const resumableCampaigns = await query<{ id: string }>(
    `SELECT id
     FROM campaigns
     WHERE channel = $1
       AND status = 'paused'
       AND (
         COALESCE(metadata ->> 'pausedReason', '') ILIKE '%configuration%'
         OR COALESCE(metadata ->> 'pausedReason', '') ILIKE '%attention%'
         OR COALESCE(metadata ->> 'pausedReason', '') ILIKE '%provider%'
       )`,
    [channel]
  );

  for (const campaign of resumableCampaigns.rows) {
    const requeueResult = await query(
      `UPDATE ${messageTable}
       SET status = 'queued', error_message = NULL
       WHERE campaign_id = $1 AND status = 'failed' AND attempts < 3
       RETURNING id`,
      [campaign.id]
    );

    await query(
      `UPDATE campaigns
       SET status = 'running', updated_at = NOW(), metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [campaign.id, JSON.stringify({ autoResumedAt: new Date().toISOString(), recoveryChannel: channel })]
    );

    await query(
      `UPDATE campaign_errors
       SET resolved = true, retried_at = NOW()
       WHERE campaign_id = $1 AND resolved = false`,
      [campaign.id]
    );

    publishEvent('campaign:resumed', {
      campaign_id: campaign.id,
      channel,
      requeued: requeueResult.rowCount ?? 0,
      autoRecovered: true,
    });
  }
}

// ── CRUD ─────────────────────────────────────────────────────────

export async function listProviders(channel?: string): Promise<ProviderConfig[]> {
  const result = channel
    ? await query<ProviderConfig>(
        `SELECT id, channel, name, display_name, is_active, priority, cost_per_msg, rate_per_sec,
                daily_limit, status, status_message, last_validated_at, extra_config, created_at, updated_at,
                jsonb_set(credentials, '{accessToken}', '"***"')::jsonb as credentials
         FROM provider_configs WHERE channel = $1 ORDER BY priority DESC`,
        [channel]
      )
    : await query<ProviderConfig>(
        `SELECT id, channel, name, display_name, is_active, priority, cost_per_msg, rate_per_sec,
                daily_limit, status, status_message, last_validated_at, extra_config, created_at, updated_at,
                jsonb_set(credentials, '{accessToken}', '"***"')::jsonb as credentials
         FROM provider_configs ORDER BY channel, priority DESC`
      );
  return result.rows;
}

export async function createProvider(data: {
  channel: string;
  name: string;
  display_name?: string;
  priority?: number;
  cost_per_msg?: number;
  rate_per_sec?: number;
  daily_limit?: number;
  credentials: Record<string, unknown>;
  extra_config?: Record<string, unknown>;
  is_active?: boolean;
}): Promise<ProviderConfig> {
  const normalizedCredentials = normalizeCredentials(data.channel, data.credentials, data.name);

  const result = await query<ProviderConfig>(
    `INSERT INTO provider_configs
       (channel, name, display_name, priority, cost_per_msg, rate_per_sec, daily_limit, credentials, extra_config, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      data.channel, data.name, data.display_name ?? data.name,
      data.priority ?? 0, data.cost_per_msg ?? 0, data.rate_per_sec ?? 10,
      data.daily_limit ?? 0, JSON.stringify(normalizedCredentials),
      JSON.stringify(data.extra_config ?? {}), data.is_active ?? true,
    ]
  );

  const created = result.rows[0];
  invalidateProviderCache(data.channel);
  await validateAndSaveStatus(created.id);
  await syncWhatsAppWebhook(created);

  return (await getProviderById(created.id)) ?? created;
}

export async function updateProvider(
  id: string,
  data: Partial<{
    display_name: string;
    priority: number;
    cost_per_msg: number;
    rate_per_sec: number;
    daily_limit: number;
    credentials: Record<string, unknown>;
    extra_config: Record<string, unknown>;
    is_active: boolean;
  }>
): Promise<ProviderConfig> {
  const current = await getProviderById(id);
  if (!current) throw new Error('Provider not found');

  const mergedCredentials = mergeCredentialPatch(
    current.credentials as Record<string, unknown>,
    data.credentials as Record<string, unknown> | undefined
  );

  const nextCredentials = normalizeCredentials(
    current.channel,
    mergedCredentials,
    current.name
  );

  const result = await query<ProviderConfig>(
    `UPDATE provider_configs SET
       display_name = $1, priority = $2, cost_per_msg = $3, rate_per_sec = $4,
       daily_limit = $5, credentials = $6, extra_config = $7, is_active = $8,
       status = 'unchecked', updated_at = NOW()
     WHERE id = $9 RETURNING *`,
    [
      data.display_name ?? current.display_name,
      data.priority ?? current.priority,
      data.cost_per_msg ?? current.cost_per_msg,
      data.rate_per_sec ?? current.rate_per_sec,
      data.daily_limit ?? current.daily_limit,
      JSON.stringify(nextCredentials),
      JSON.stringify(data.extra_config ?? current.extra_config),
      data.is_active ?? current.is_active,
      id,
    ]
  );

  const updated = result.rows[0];
  invalidateProviderCache(current.channel);
  await validateAndSaveStatus(updated.id);
  await syncWhatsAppWebhook(updated);

  return (await getProviderById(updated.id)) ?? updated;
}

export async function deleteProvider(id: string): Promise<void> {
  const current = await getProviderById(id);
  if (!current) throw new Error('Provider not found');
  await query(`DELETE FROM provider_configs WHERE id = $1`, [id]);
  invalidateProviderCache(current.channel);
}

export async function reorderProviders(channel: string, ordered: Array<{ id: string; priority: number }>): Promise<void> {
  for (const { id, priority } of ordered) {
    await query(`UPDATE provider_configs SET priority = $1, updated_at = NOW() WHERE id = $2 AND channel = $3`, [priority, id, channel]);
  }
  invalidateProviderCache(channel);
}

// ── WhatsApp: validate credentials ───────────────────────────────

interface WaValidateResult {
  valid: boolean;
  businessAccountId?: string;
  phoneDisplayName?: string;
  error?: string;
}

export async function validateWhatsAppCredentials(
  phoneNumberId: string,
  accessToken: string,
  apiVersion = 'v21.0'
): Promise<WaValidateResult> {
  try {
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const errArr = (json as { error?: { message?: string } }).error;
      return { valid: false, error: errArr?.message ?? `HTTP ${res.status}` };
    }
    return {
      valid: true,
      phoneDisplayName: json.verified_name as string ?? json.display_phone_number as string,
    };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}

// ── WhatsApp: register & verify webhook ──────────────────────────

export async function registerWhatsAppWebhook(
  phoneNumberId: string,
  accessToken: string,
  webhookUrl: string,
  verifyToken: string,
  apiVersion = 'v21.0'
): Promise<{ success: boolean; error?: string }> {
  // First, look up the WABA ID
  try {
    const wabaRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=whatsapp_business_account`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }
    );
    const wabaJson = (await wabaRes.json()) as Record<string, unknown>;
    const wabaId = (wabaJson.whatsapp_business_account as { id?: string } | undefined)?.id;
    if (!wabaId) return { success: false, error: 'Could not resolve WhatsApp Business Account ID' };

    const regRes = await fetch(
      `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callback_url: webhookUrl,
          verify_token: verifyToken,
          subscribed_fields: ['messages'],
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const regJson = (await regRes.json()) as Record<string, unknown>;
    if (!regRes.ok) {
      const msg = ((regJson as { error?: { message?: string } }).error)?.message ?? `HTTP ${regRes.status}`;
      return { success: false, error: msg };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── WhatsApp: send a test message ─────────────────────────────────

export async function testWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  apiVersion = 'v21.0'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: '✅ MsgCRM test message — your WhatsApp provider is configured correctly!' },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
    if (!res.ok) return { success: false, error: json.error?.message ?? `HTTP ${res.status}` };
    return { success: true, messageId: json.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── SMS: test provider ────────────────────────────────────────────

export async function testSmsProvider(
  credentials: Record<string, unknown>,
  to: string
): Promise<{ success: boolean; error?: string }> {
  const provider = credentials.provider as string;
  const message = '✅ MsgCRM test SMS — your provider is configured correctly!';

  try {
    if (provider === 'fast2sms') {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: credentials.apiKey as string, 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables_values: message, route: 'q', numbers: to }),
        signal: AbortSignal.timeout(15000),
      });
      const json = (await res.json()) as { return?: boolean; message?: string[] };
      if (!json.return) return { success: false, error: json.message?.join(', ') ?? 'Failed' };
      return { success: true };
    }

    if (provider === 'msg91') {
      const res = await fetch('https://api.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { authkey: credentials.authKey as string, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow_id: 'test',
          sender: credentials.senderId,
          mobiles: to,
          VAR1: message,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const json = (await res.json()) as { type?: string; message?: string };
      if (json.type !== 'success') return { success: false, error: json.message ?? 'Failed' };
      return { success: true };
    }

    if (provider === 'textlocal') {
      const res = await fetch('https://api.textlocal.in/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          apikey: credentials.apiKey as string,
          numbers: to,
          message,
          sender: (credentials.sender as string) || (credentials.senderId as string) || 'TXTLCL',
        }),
        signal: AbortSignal.timeout(15000),
      });
      const json = (await res.json()) as { status?: string; errors?: Array<{ message: string }> };
      if (json.status !== 'success') return { success: false, error: json.errors?.[0]?.message ?? 'Failed' };
      return { success: true };
    }

    if (provider === 'custom') {
      const res = await fetch(credentials.apiUrl as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credentials.apiKey as string}` },
        body: JSON.stringify({ to, message, senderId: credentials.senderId }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
      return { success: true };
    }

    return { success: false, error: `Test not supported for provider: ${provider}` };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Email: test provider ──────────────────────────────────────────

export async function testEmailProvider(
  credentials: Record<string, unknown>,
  to: string
): Promise<{ success: boolean; error?: string }> {
  const provider = credentials.provider as string;

  try {
    if (provider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: credentials.fromEmail as string ?? 'onboarding@resend.dev',
          to,
          subject: '✅ MsgCRM Test Email',
          html: '<p>Your email provider is configured correctly in MsgCRM!</p>',
        }),
        signal: AbortSignal.timeout(15000),
      });
      const json = (await res.json()) as { id?: string; message?: string };
      if (!res.ok) return { success: false, error: json.message ?? `HTTP ${res.status}` };
      return { success: true };
    }

    if (provider === 'sendgrid') {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: credentials.fromEmail as string ?? 'test@yourdomain.com' },
          subject: '✅ MsgCRM Test Email',
          content: [{ type: 'text/html', value: '<p>Your SendGrid provider is working correctly!</p>' }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const json = (await res.json()) as { errors?: Array<{ message: string }> };
        return { success: false, error: json.errors?.[0]?.message ?? `HTTP ${res.status}` };
      }
      return { success: true };
    }

    if (provider === 'smtp') {
      const transporter = nodemailer.createTransport({
        host: credentials.host as string,
        port: Number(credentials.port ?? 587),
        secure: Boolean(credentials.secure ?? Number(credentials.port) === 465),
        auth: {
          user: credentials.user as string,
          pass: credentials.pass as string,
        },
      });
      await transporter.verify();
      await transporter.sendMail({
        from: credentials.fromEmail as string,
        to,
        subject: '✅ MsgCRM Test Email',
        html: '<p>Your SMTP provider is configured correctly in MsgCRM.</p>',
      });
      return { success: true };
    }

    return { success: false, error: `Test not supported for provider: ${provider}` };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ── Validate + persist result ─────────────────────────────────────

export async function validateAndSaveStatus(id: string): Promise<{ valid: boolean; message: string }> {
  const provider = await getProviderById(id);
  if (!provider) throw new Error('Provider not found');

  let valid = false;
  let message = '';

  try {
    if (provider.channel === 'whatsapp') {
      const creds = provider.credentials as Record<string, string>;
      const result = await validateWhatsAppCredentials(
        creds.phoneNumberId,
        creds.accessToken,
        creds.apiVersion
      );
      valid = result.valid;
      message = result.valid
        ? `Connected — ${result.phoneDisplayName ?? 'verified'}`
        : result.error ?? 'Validation failed';
    } else if (provider.channel === 'sms') {
      // Ping: fast2sms balance check
      const creds = provider.credentials as Record<string, string>;
      if (creds.provider === 'fast2sms') {
        const res = await fetch('https://www.fast2sms.com/dev/wallet', {
          headers: { authorization: creds.apiKey },
          signal: AbortSignal.timeout(10000),
        });
        const json = (await res.json()) as { return?: boolean; wallet?: string };
        valid = !!json.return;
        message = valid ? `Connected — balance: ₹${json.wallet ?? '?'}` : 'Invalid API key';
      } else {
        valid = true;
        message = 'Credentials saved (live validation requires a test send)';
      }
    } else if (provider.channel === 'email') {
      const creds = provider.credentials as Record<string, unknown>;
      const providerType = (creds.provider as string) || provider.name;

      if (providerType === 'smtp') {
        const transporter = nodemailer.createTransport({
          host: creds.host as string,
          port: Number(creds.port ?? 587),
          secure: Boolean(creds.secure ?? Number(creds.port) === 465),
          auth: { user: creds.user as string, pass: creds.pass as string },
        });
        await transporter.verify();
        valid = true;
        message = 'SMTP connection verified';
      } else if (providerType === 'resend') {
        const res = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${creds.apiKey as string}` },
          signal: AbortSignal.timeout(10000),
        });
        valid = res.ok;
        message = valid ? 'Resend API key verified' : `HTTP ${res.status}`;
      } else if (providerType === 'sendgrid') {
        const res = await fetch('https://api.sendgrid.com/v3/user/profile', {
          headers: { Authorization: `Bearer ${creds.apiKey as string}` },
          signal: AbortSignal.timeout(10000),
        });
        valid = res.ok;
        message = valid ? 'SendGrid API key verified' : `HTTP ${res.status}`;
      } else {
        valid = true;
        message = 'Credentials saved (send a test email to verify)';
      }
    }
  } catch (err) {
    valid = false;
    message = (err as Error).message;
    log.warn(`Validation error for provider ${provider.name}: ${message}`);
  }

  await setProviderStatus(id, valid ? 'connected' : 'failed', message);
  if (valid) {
    await resumePausedCampaignsForChannel(provider.channel);
  }
  return { valid, message };
}
