import { z } from 'zod';

export const SegmentSchema = z.enum(['hot', 'warm', 'cold']);
export const LeadStatusSchema = z.enum(['new', 'contacted', 'converted', 'lost']);
export const LeadChannelSchema = z.enum(['whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram']);

export const CreateLeadSchema = z.object({
  channel: LeadChannelSchema,
  contact_value: z.string().min(1),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().max(50).optional(),
  status: LeadStatusSchema.optional().default('new'),
  segment: SegmentSchema.optional().default('cold'),
  tags: z.array(z.string()).optional().default([]),
  is_vip: z.boolean().optional().default(false),
  assigned_to: z.string().optional(),
  campaign_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const UpdateLeadSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().max(50).optional(),
  status: LeadStatusSchema.optional(),
  segment: SegmentSchema.optional(),
  tags: z.array(z.string()).optional(),
  is_vip: z.boolean().optional(),
  assigned_to: z.string().optional(),
  campaign_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const TagLeadSchema = z.object({
  tags: z.array(z.string().min(1)).min(1),
  action: z.enum(['add', 'remove', 'set']).default('add'),
});

export const SetSegmentSchema = z.object({
  segment: SegmentSchema,
});

export const ListLeadsQuerySchema = z.object({
  channel: LeadChannelSchema.optional(),
  segment: SegmentSchema.optional(),
  status: LeadStatusSchema.optional(),
  tag: z.string().optional(),
  assigned_to: z.string().optional(),
  source: z.string().optional(),
  is_vip: z.coerce.boolean().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export interface Lead {
  id: string;
  tenant_id: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'telegram' | 'messenger' | 'instagram';
  contact_value: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: 'new' | 'contacted' | 'converted' | 'lost';
  segment: 'hot' | 'warm' | 'cold';
  tags: string[];
  is_vip: boolean;
  assigned_to: string | null;
  campaign_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  last_contacted_at: Date | null;
  response_count: number;
  created_at: Date;
  updated_at: Date;
}
