import { z } from 'zod';

// ── Send schema ───────────────────────────────────────────────────
export const SendMessengerSchema = z.object({
  campaign_id: z.string().uuid(),
  recipient_id: z.string().min(1),
  message: z.string().min(1),
  message_type: z.enum(['text', 'image', 'template', 'generic_template', 'button_template']).default('text'),
  image_url: z.string().url().optional(),
  buttons: z.array(z.object({
    type: z.enum(['web_url', 'postback']),
    title: z.string().max(20),
    url: z.string().url().optional(),
    payload: z.string().optional(),
  })).max(3).optional(),
  quick_replies: z.array(z.object({
    content_type: z.enum(['text', 'user_phone_number', 'user_email']).default('text'),
    title: z.string().max(20).optional(),
    payload: z.string().optional(),
  })).max(13).optional(),
  tag: z.enum(['CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE', 'ACCOUNT_UPDATE', 'HUMAN_AGENT']).optional(),
  provider_chain: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(10).default(0),
});

// ── Batch schema ──────────────────────────────────────────────────
export const MessengerBatchSchema = z.object({
  campaign_id: z.string().uuid(),
  contacts: z.array(z.object({
    recipient_id: z.string().min(1),
    params: z.record(z.string()).optional(),
  })).min(1).max(500),
  message: z.string().min(1),
  message_type: z.enum(['text', 'image', 'template', 'generic_template', 'button_template']).default('text'),
  image_url: z.string().url().optional(),
  buttons: z.array(z.object({
    type: z.enum(['web_url', 'postback']),
    title: z.string().max(20),
    url: z.string().url().optional(),
    payload: z.string().optional(),
  })).max(3).optional(),
  quick_replies: z.array(z.object({
    content_type: z.enum(['text', 'user_phone_number', 'user_email']).default('text'),
    title: z.string().max(20).optional(),
    payload: z.string().optional(),
  })).max(13).optional(),
  tag: z.enum(['CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE', 'ACCOUNT_UPDATE', 'HUMAN_AGENT']).optional(),
  provider_chain: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(10).default(0),
});

// ── TypeScript interface ──────────────────────────────────────────
export interface MessengerMessage {
  id: string;
  campaign_id: string;
  recipient_id: string;
  message: string;
  message_type: 'text' | 'image' | 'template' | 'generic_template' | 'button_template';
  image_url?: string;
  buttons?: Array<{ type: string; title: string; url?: string; payload?: string }>;
  quick_replies?: Array<{ content_type: string; title?: string; payload?: string }>;
  tag?: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'blocked';
  provider_used?: string;
  provider_msg_id?: string;
  attempts: number;
  error_message?: string;
  cost: number;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  created_at: Date;
}
