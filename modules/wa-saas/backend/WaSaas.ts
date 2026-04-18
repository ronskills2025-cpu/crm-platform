import { z } from 'zod';

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 1: DRIP MARKETING
// ══════════════════════════════════════════════════════════════════════════
export const CreateDripCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  trigger_type: z.enum(['manual', 'new_lead', 'tag_added', 'form_submitted', 'keyword']).default('manual'),
  trigger_config: z.record(z.unknown()).default({}),
  segment_filter: z.record(z.unknown()).default({}),
  stop_on_reply: z.boolean().default(true),
});
export const UpdateDripCampaignSchema = CreateDripCampaignSchema.partial();

export const CreateDripStepSchema = z.object({
  campaign_id: z.string().uuid(),
  step_order: z.number().int().min(0),
  delay_days: z.number().int().min(0).default(0),
  delay_hours: z.number().int().min(0).default(0),
  message_type: z.enum(['text', 'template', 'image', 'video', 'document']).default('text'),
  template_name: z.string().max(200).optional(),
  message_body: z.string().optional(),
  media_url: z.string().url().optional(),
  buttons: z.array(z.record(z.unknown())).default([]),
});
export const UpdateDripStepSchema = CreateDripStepSchema.partial().omit({ campaign_id: true });

export const EnrollDripSchema = z.object({
  campaign_id: z.string().uuid(),
  contact_phone: z.string().min(1).max(20),
  contact_name: z.string().max(200).optional(),
});

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 2: AI AUTO-REPLY BOT
// ══════════════════════════════════════════════════════════════════════════
export const CreateAiBotConfigSchema = z.object({
  name: z.string().min(1).max(200),
  model: z.string().max(60).default('gpt-4o-mini'),
  system_prompt: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().int().min(50).max(4096).default(500),
  human_takeover_enabled: z.boolean().default(true),
  takeover_keywords: z.array(z.string()).default(['help', 'agent', 'human', 'operator']),
  business_hours: z.record(z.unknown()).default({}),
  fallback_message: z.string().optional(),
});
export const UpdateAiBotConfigSchema = CreateAiBotConfigSchema.partial();

export const CreateFaqEntrySchema = z.object({
  bot_config_id: z.string().uuid(),
  question: z.string().min(1),
  answer: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  priority: z.number().int().default(0),
});
export const UpdateFaqEntrySchema = CreateFaqEntrySchema.partial().omit({ bot_config_id: true });

export const AiConversationActionSchema = z.object({
  action: z.enum(['takeover', 'release', 'close']),
  agent_id: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 3: ORDER TRACKING
// ══════════════════════════════════════════════════════════════════════════
export const CreateOrderConfigSchema = z.object({
  name: z.string().min(1).max(200),
  shipping_provider: z.string().max(60).optional(),
  notify_on_shipped: z.boolean().default(true),
  notify_on_out_for_delivery: z.boolean().default(true),
  notify_on_delivered: z.boolean().default(true),
  notify_on_delay: z.boolean().default(true),
  delay_threshold_hours: z.number().int().default(48),
  message_templates: z.record(z.unknown()).default({}),
});
export const UpdateOrderConfigSchema = CreateOrderConfigSchema.partial();

export const CreateOrderSchema = z.object({
  config_id: z.string().uuid().optional(),
  order_number: z.string().min(1).max(100),
  customer_phone: z.string().min(1).max(20),
  customer_name: z.string().max(200).optional(),
  tracking_number: z.string().max(200).optional(),
  tracking_url: z.string().url().optional(),
  carrier: z.string().max(60).optional(),
  estimated_delivery: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export const UpdateOrderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned']).optional(),
  tracking_number: z.string().max(200).optional(),
  tracking_url: z.string().url().optional(),
  carrier: z.string().max(60).optional(),
  estimated_delivery: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateOrderEventSchema = z.object({
  order_id: z.string().uuid(),
  event_type: z.string().min(1).max(40),
  description: z.string().optional(),
  location: z.string().max(200).optional(),
});

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 4: SUBSCRIPTION BOT
// ══════════════════════════════════════════════════════════════════════════
export const CreateSubPlanSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  billing_cycle: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).default('monthly'),
  grace_period_days: z.number().int().default(3),
  reminder_days_before: z.array(z.number().int()).default([7, 3, 1]),
  auto_pause_on_fail: z.boolean().default(true),
});
export const UpdateSubPlanSchema = CreateSubPlanSchema.partial();

export const CreateSubscriptionSchema = z.object({
  plan_id: z.string().uuid(),
  customer_phone: z.string().min(1).max(20),
  customer_name: z.string().max(200).optional(),
  customer_email: z.string().email().optional(),
  payment_method: z.record(z.unknown()).default({}),
});

export const SubscriptionActionSchema = z.object({
  action: z.enum(['pause', 'resume', 'cancel']),
});

export const RecordSubPaymentSchema = z.object({
  subscription_id: z.string().uuid(),
  amount: z.number().min(0),
  currency: z.string().length(3).default('USD'),
  payment_ref: z.string().max(200).optional(),
});

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 5: FLASH SALE
// ══════════════════════════════════════════════════════════════════════════
export const CreateFlashSaleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  offer_text: z.string().min(1),
  discount_code: z.string().max(60).optional(),
  starts_at: z.string(),
  ends_at: z.string(),
  segment_filter: z.record(z.unknown()).default({}),
  send_countdown: z.boolean().default(true),
  countdown_intervals: z.array(z.number().int()).default([60, 30, 10]),
  final_reminder_min: z.number().int().default(5),
  template_name: z.string().max(200).optional(),
  media_url: z.string().url().optional(),
});
export const UpdateFlashSaleSchema = CreateFlashSaleSchema.partial();

export const FlashSaleActionSchema = z.object({
  action: z.enum(['activate', 'pause', 'cancel']),
});

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 6: TEAM INBOX
// ══════════════════════════════════════════════════════════════════════════
export const CreateAgentSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  role: z.enum(['agent', 'supervisor', 'admin']).default('agent'),
  max_concurrent: z.number().int().min(1).default(10),
});
export const UpdateAgentSchema = CreateAgentSchema.partial();

export const AssignConversationSchema = z.object({
  agent_id: z.string().uuid().nullable(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

export const AddTagsSchema = z.object({
  tags: z.array(z.string().min(1)),
});

export const CreateNoteSchema = z.object({
  conversation_id: z.string().uuid(),
  note: z.string().min(1),
});

export const TeamReplySchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().min(1),
  message_type: z.enum(['text', 'template', 'image']).default('text'),
  media_url: z.string().url().optional(),
});

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 7: LINK TRACKING
// ══════════════════════════════════════════════════════════════════════════
export const CreateTrackedLinkSchema = z.object({
  name: z.string().min(1).max(200),
  original_url: z.string().url(),
  campaign_ref: z.string().max(200).optional(),
  expires_at: z.string().optional(),
});
export const UpdateTrackedLinkSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  is_active: z.boolean().optional(),
  expires_at: z.string().nullable().optional(),
});

export const RecordConversionSchema = z.object({
  link_id: z.string().uuid(),
  contact_phone: z.string().max(20).optional(),
  conversion_value: z.number().min(0).optional(),
});

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 8: RE-ENGAGEMENT
// ══════════════════════════════════════════════════════════════════════════
export const CreateReengagementSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  inactivity_days: z.number().int().min(1).default(30),
  segment_filter: z.record(z.unknown()).default({}),
  message_type: z.enum(['text', 'template']).default('template'),
  template_name: z.string().max(200).optional(),
  message_body: z.string().optional(),
  offer_code: z.string().max(60).optional(),
  media_url: z.string().url().optional(),
});
export const UpdateReengagementSchema = CreateReengagementSchema.partial();

export const ReengagementActionSchema = z.object({
  action: z.enum(['activate', 'pause', 'cancel']),
});

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 9: BROADCAST OPTIMIZER
// ══════════════════════════════════════════════════════════════════════════
export const CreateBroadcastOptimizerSchema = z.object({
  name: z.string().min(1).max(200),
  smart_timing_enabled: z.boolean().default(true),
  timezone: z.string().max(60).default('UTC'),
  preferred_hours: z.object({ start: z.number().int().min(0).max(23), end: z.number().int().min(0).max(23) }).default({ start: 9, end: 21 }),
  rate_limit_per_sec: z.number().int().min(1).default(30),
  rate_limit_per_min: z.number().int().min(1).default(500),
  template_rotation_enabled: z.boolean().default(false),
  templates: z.array(z.record(z.unknown())).default([]),
});
export const UpdateBroadcastOptimizerSchema = CreateBroadcastOptimizerSchema.partial();

export const CreateBroadcastBatchSchema = z.object({
  config_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  template_name: z.string().max(200).optional(),
  message_body: z.string().optional(),
  segment_filter: z.record(z.unknown()).default({}),
  scheduled_at: z.string().optional(),
});
export const UpdateBroadcastBatchSchema = CreateBroadcastBatchSchema.partial();

// ══════════════════════════════════════════════════════════════════════════
//  MODULE 10: DIGITAL BUSINESS CARD BOT
// ══════════════════════════════════════════════════════════════════════════
export const CreateBusinessCardSchema = z.object({
  name: z.string().min(1).max(200),
  business_name: z.string().min(1).max(200),
  tagline: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  website_url: z.string().url().optional(),
  address: z.string().optional(),
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
  services: z.array(z.record(z.unknown())).default([]),
  social_links: z.record(z.unknown()).default({}),
  logo_url: z.string().url().optional(),
  cover_url: z.string().url().optional(),
  interactive_buttons: z.array(z.record(z.unknown())).default([]),
  lead_capture_enabled: z.boolean().default(true),
  lead_capture_fields: z.array(z.string()).default(['name', 'phone', 'interest']),
  trigger_keyword: z.string().max(60).default('card'),
});
export const UpdateBusinessCardSchema = CreateBusinessCardSchema.partial();

export const BusinessCardLeadSchema = z.object({
  card_id: z.string().uuid(),
  contact_phone: z.string().min(1).max(20),
  contact_name: z.string().max(200).optional(),
  data: z.record(z.unknown()).default({}),
  source: z.string().max(40).default('whatsapp'),
});
