import { z } from 'zod';

export const SendTelegramSchema = z.object({
  chat_id: z.string().min(1),
  message: z.string().min(1),
  parse_mode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
  reply_markup: z.record(z.unknown()).optional(),
});

export const TelegramBatchSchema = z.object({
  campaign_id: z.string().uuid(),
  contacts: z.array(z.object({
    chat_id: z.string().min(1),
    params: z.record(z.string()).optional(),
  })).min(1).max(500),
  message: z.string().min(1),
  parse_mode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
  photo_url: z.string().url().optional(),
  reply_markup: z.record(z.unknown()).optional(),
  provider_chain: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(10).default(0),
});

export interface TelegramMessage {
  id: string;
  campaign_id: string;
  chat_id: string;
  message: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  photo_url?: string;
  reply_markup?: Record<string, unknown>;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'blocked';
  provider_used?: string;
  provider_msg_id?: string;
  attempts: number;
  error_message?: string;
  cost: number;
  sent_at?: Date;
  delivered_at?: Date;
  created_at: Date;
}
