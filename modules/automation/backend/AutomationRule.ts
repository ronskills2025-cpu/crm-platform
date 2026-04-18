import { z } from 'zod';

export const TriggerTypeSchema = z.enum([
  'message_received',
  'message_failed',
  'no_reply',
  'campaign_completed',
  'lead_tagged',
  'lead_segment_changed',
  'scheduled',
]);

export const ActionTypeSchema = z.enum([
  'send_reply',
  'tag_lead',
  'set_segment',
  'assign_thread',
  'escalate',
  'notify',
  'create_followup',
]);

export const ConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

export const RuleActionSchema = z.object({
  type: ActionTypeSchema,
  config: z.record(z.unknown()).optional().default({}),
});

export const CreateAutomationRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  channel: z.enum(['whatsapp', 'sms', 'email', 'all']).default('all'),
  trigger_type: TriggerTypeSchema,
  trigger_config: z.record(z.unknown()).optional().default({}),
  conditions: z.array(ConditionSchema).optional().default([]),
  actions: z.array(RuleActionSchema).min(1),
  is_active: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
});

export const UpdateAutomationRuleSchema = CreateAutomationRuleSchema.partial();

export const CreateScheduledCampaignSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['whatsapp', 'sms', 'email']),
  campaign_config: z.object({
    contacts: z.array(z.record(z.string())).optional(),
    message: z.string().min(1),
    subject: z.string().optional(),
    html_body: z.string().optional(),
    template_id: z.string().optional(),
    provider_chain: z.array(z.string()).optional(),
    campaign_name: z.string().optional(),
  }),
  schedule_type: z.enum(['once', 'daily', 'weekly', 'monthly']).default('once'),
  scheduled_at: z.string().datetime(),
});

export const UpdateScheduledCampaignSchema = z.object({
  name: z.string().optional(),
  campaign_config: z.record(z.unknown()).optional(),
  schedule_type: z.enum(['once', 'daily', 'weekly', 'monthly']).optional(),
  scheduled_at: z.string().datetime().optional(),
  status: z.enum(['pending', 'paused']).optional(),
});

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  channel: 'whatsapp' | 'sms' | 'email' | 'all';
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Array<Record<string, unknown>>;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  is_active: boolean;
  priority: number;
  last_triggered_at: Date | null;
  trigger_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface ScheduledCampaign {
  id: string;
  name: string;
  channel: 'whatsapp' | 'sms' | 'email';
  campaign_config: Record<string, unknown>;
  schedule_type: 'once' | 'daily' | 'weekly' | 'monthly';
  scheduled_at: Date;
  next_run_at: Date | null;
  last_run_at: Date | null;
  run_count: number;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'failed';
  created_at: Date;
  updated_at: Date;
}
