import { z } from 'zod';

// ── Credential schemas per channel ────────────────────────────────

export const WhatsAppCredentialsSchema = z.object({
  phoneNumberId: z.string().min(1, 'Phone Number ID required'),
  accessToken: z.string().min(1, 'Access Token required'),
  apiVersion: z.string().default('v21.0'),
  verifyToken: z.string().optional(),
  businessAccountId: z.string().optional(),
  webhookUrl: z.string().url().optional().or(z.literal('')),
});

export const SmsCredentialsSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('self'),
    gatewayUrl: z.string().url('Gateway URL required'),
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    senderId: z.string().optional(),
    headers: z.string().optional(),
    method: z.enum(['POST', 'PUT']).optional().default('POST'),
    region: z.string().optional(),
  }),
  z.object({
    provider: z.literal('fast2sms'),
    apiKey: z.string().min(1),
    senderId: z.string().optional(),
    dltEntityId: z.string().optional(),
    region: z.string().optional().default('IN'),
  }),
  z.object({
    provider: z.literal('msg91'),
    authKey: z.string().min(1),
    senderId: z.string().min(1),
    dltEntityId: z.string().optional(),
    region: z.string().optional().default('IN'),
  }),
  z.object({
    provider: z.literal('textlocal'),
    apiKey: z.string().min(1),
    sender: z.string().optional(),
    region: z.string().optional().default('IN'),
  }),
  z.object({
    provider: z.literal('twilio'),
    accountSid: z.string().min(1),
    authToken: z.string().min(1),
    fromNumber: z.string().min(1),
    region: z.string().optional(),
  }),
  z.object({
    provider: z.literal('aws_sns'),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
    region: z.string().optional().default('us-east-1'),
  }),
  z.object({
    provider: z.literal('custom'),
    apiKey: z.string().min(1),
    apiUrl: z.string().url(),
    senderId: z.string().optional(),
    headers: z.string().optional(),
    bodyTemplate: z.string().optional(),
    region: z.string().optional(),
  }),
]);

export const EmailCredentialsSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('resend'),
    apiKey: z.string().min(1),
    fromEmail: z.string().email(),
    fromName: z.string().optional(),
  }),
  z.object({
    provider: z.literal('sendgrid'),
    apiKey: z.string().min(1),
    fromEmail: z.string().email(),
    fromName: z.string().optional(),
  }),
  z.object({
    provider: z.literal('smtp'),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    user: z.string().min(1),
    pass: z.string().min(1),
    fromEmail: z.string().email(),
    fromName: z.string().optional(),
    secure: z.boolean().optional().default(false),
  }),
]);

// ── CRUD schemas ──────────────────────────────────────────────────

export const CreateProviderConfigSchema = z.object({
  channel: z.enum(['whatsapp', 'sms', 'email', 'telegram', 'messenger']),
  name: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/, 'Lowercase alphanumeric, dashes, underscores only'),
  display_name: z.string().max(100).optional(),
  priority: z.number().int().min(0).max(100).default(0),
  cost_per_msg: z.number().min(0).default(0),
  rate_per_sec: z.number().int().min(1).max(1000).default(10),
  daily_limit: z.number().int().min(0).default(0),
  credentials: z.record(z.unknown()),
  extra_config: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional().default(true),
});

export const UpdateProviderConfigSchema = CreateProviderConfigSchema.partial().omit({ channel: true, name: true });

export const TestProviderSchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1).optional(),
  subject: z.string().optional(),
});

// ── TypeScript interfaces ─────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'telegram' | 'messenger';
  name: string;
  display_name: string | null;
  is_active: boolean;
  priority: number;
  cost_per_msg: number;
  rate_per_sec: number;
  daily_limit: number;
  credentials: Record<string, unknown>;
  extra_config: Record<string, unknown>;
  status: 'connected' | 'failed' | 'unchecked' | 'paused';
  status_message: string | null;
  last_validated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface WhatsAppWebhook {
  id: string;
  provider_config_id: string;
  phone_number_id: string;
  webhook_url: string | null;
  verify_token: string | null;
  business_account_id: string | null;
  is_registered: boolean;
  registered_at: Date | null;
}
