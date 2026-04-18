import { z } from 'zod';

export const SendEmailSchema = z.object({
  to_email: z.string().email(),
  subject: z.string().min(1).max(500),
  html_body: z.string().optional(),
  text_body: z.string().optional(),
});

export const EmailBatchSchema = z.object({
  campaign_id: z.string().uuid(),
  contacts: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional(),
    params: z.record(z.string()).optional(),
  })).min(1).max(500),
  subject: z.string().min(1).max(500),
  html_body: z.string().optional(),
  text_body: z.string().optional(),
  provider_chain: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(10).default(0),
});

export interface EmailMessage {
  id: string;
  campaign_id: string;
  to_email: string;
  from_email?: string;
  subject: string;
  html_body?: string;
  text_body?: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  provider_used?: string;
  provider_msg_id?: string;
  attempts: number;
  error_message?: string;
  cost: number;
  opened_at?: Date;
  clicked_at?: Date;
  sent_at?: Date;
  delivered_at?: Date;
  created_at: Date;
}
