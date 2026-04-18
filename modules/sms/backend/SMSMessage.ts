import { z } from 'zod';

export const SendSMSSchema = z.object({
  phone: z.string().min(10).max(20),
  message: z.string().min(1).max(160),
  sender_id: z.string().max(10).optional(),
  dlt_template_id: z.string().optional(),
});

export const SMSBatchSchema = z.object({
  campaign_id: z.string().uuid(),
  contacts: z.array(z.object({
    phone: z.string().min(10).max(20),
    region: z.string().optional(),
  })).min(1).max(500),
  message: z.string().min(1),
  sender_id: z.string().max(20).optional(),
  dlt_template_id: z.string().optional(),
  provider_chain: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(10).default(0),
  /** When true, sends with DLT compliance (registered sender ID + DLT template). When false, sends without DLT. */
  use_dlt: z.boolean().optional().default(false),
  /** Use a specific virtual number as sender for non-DLT / unofficial sending */
  virtual_number_id: z.string().uuid().optional(),
});

export interface SMSMessage {
  id: string;
  campaign_id: string;
  phone: string;
  message: string;
  sender_id?: string;
  dlt_template_id?: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed';
  provider_used?: string;
  provider_msg_id?: string;
  attempts: number;
  error_message?: string;
  cost: number;
  region?: string;
  sent_at?: Date;
  delivered_at?: Date;
  created_at: Date;
}
