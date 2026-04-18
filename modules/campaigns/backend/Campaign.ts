import { z } from 'zod';

export const CampaignStatus = z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'failed']);
export const ChannelType = z.enum(['whatsapp', 'sms', 'email', 'telegram', 'messenger']);

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  channel: ChannelType,
  message_body: z.string().optional(),
  subject: z.string().max(500).optional(),
  template_id: z.string().optional(),
  provider_chain: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(10).default(0),
  scheduled_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateCampaignSchema = z.object({
  status: CampaignStatus.optional(),
  name: z.string().min(1).max(255).optional(),
  scheduled_at: z.string().datetime().optional(),
  priority: z.number().int().min(0).max(10).optional(),
});

export interface Campaign {
  id: string;
  name: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'telegram' | 'messenger';
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  priority: number;
  template_id?: string;
  message_body?: string;
  subject?: string;
  provider_chain: string[];
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
