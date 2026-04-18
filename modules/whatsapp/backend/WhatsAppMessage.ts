import { z } from 'zod';

export const SendWhatsAppSchema = z.object({
  phone: z.string().min(10).max(20),
  message: z.string().min(1),
  template_id: z.string().optional(),
  template_params: z.array(z.string()).optional(),
});

export const WhatsAppBatchSchema = z.object({
  campaign_id: z.string().uuid(),
  contacts: z.array(z.object({
    phone: z.string().min(10).max(20),
    params: z.record(z.string()).optional(),
  })).min(1).max(500),
  message: z.string().min(1),
  template_id: z.string().optional(),
  provider_chain: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(10).default(0),
});

export interface WhatsAppMessage {
  id: string;
  campaign_id: string;
  phone: string;
  message: string;
  template_id?: string;
  template_params: string[];
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'read';
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
