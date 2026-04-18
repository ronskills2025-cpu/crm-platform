import { z } from 'zod';

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 1: OMNICHANNEL LEAD CAPTURE
// ══════════════════════════════════════════════════════════════════════════════

export const CreateLeadCaptureFormSchema = z.object({
  name: z.string().min(1).max(200),
  source: z.enum(['website', 'whatsapp', 'instagram', 'facebook', 'manual']).default('website'),
  form_fields: z.array(z.object({
    name: z.string(), label: z.string(), type: z.string().default('text'), required: z.boolean().default(false),
  })).default([]),
  auto_response_enabled: z.boolean().default(false),
  auto_response_channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
  auto_response_template: z.string().optional(),
  auto_tags: z.array(z.string()).default([]),
  assigned_operator: z.string().optional(),
  webhook_url: z.string().url().optional(),
});

export const UpdateLeadCaptureFormSchema = CreateLeadCaptureFormSchema.partial();

export const SubmitLeadCaptureSchema = z.object({
  form_id: z.string().uuid().optional(),
  source: z.string().min(1),
  channel: z.enum(['whatsapp', 'instagram', 'sms', 'email', 'website']).optional(),
  contact_value: z.string().min(1).max(200),
  name: z.string().max(200).optional(),
  data: z.record(z.unknown()).default({}),
});

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 2: MISSED CALL AUTOMATION
// ══════════════════════════════════════════════════════════════════════════════

export const CreateMissedCallConfigSchema = z.object({
  name: z.string().min(1).max(200),
  phone_number: z.string().min(1).max(20),
  reply_channel: z.enum(['whatsapp', 'sms']).default('whatsapp'),
  reply_template: z.string().min(1),
  followup_template: z.string().optional(),
  followup_delay_sec: z.number().int().min(0).default(300),
  capture_intent: z.boolean().default(true),
  intent_keywords: z.record(z.string()).default({}),
});

export const UpdateMissedCallConfigSchema = CreateMissedCallConfigSchema.partial();

export const LogMissedCallSchema = z.object({
  config_id: z.string().uuid().optional(),
  caller_number: z.string().min(1).max(20),
  called_number: z.string().min(1).max(20),
  call_time: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 3: SMART FOLLOW-UP SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

const FollowupStepSchema = z.object({
  delay_sec: z.number().int().min(0),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
  template: z.string().min(1),
  condition: z.string().optional(),
});

export const CreateFollowupSequenceSchema = z.object({
  name: z.string().min(1).max(200),
  trigger_type: z.enum(['no_reply', 'interested', 'custom', 'tag_added', 'stage_changed']).default('no_reply'),
  trigger_conditions: z.record(z.unknown()).default({}),
  steps: z.array(FollowupStepSchema).min(1),
  notify_team: z.boolean().default(true),
  notification_channels: z.array(z.string()).default(['whatsapp']),
});

export const UpdateFollowupSequenceSchema = CreateFollowupSequenceSchema.partial();

export const EnrollFollowupSchema = z.object({
  sequence_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  contact_value: z.string().min(1),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
});

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 4: LOYALTY SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

export const CreateLoyaltyProgramSchema = z.object({
  name: z.string().min(1).max(200),
  points_per_purchase: z.number().int().min(0).default(10),
  points_per_referral: z.number().int().min(0).default(50),
  points_per_review: z.number().int().min(0).default(25),
  currency_value: z.number().min(0).default(0.01),
});

export const UpdateLoyaltyProgramSchema = CreateLoyaltyProgramSchema.partial();

export const AddLoyaltyMemberSchema = z.object({
  program_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
  name: z.string().max(200).optional(),
  contact_value: z.string().min(1).max(200),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
});

export const LoyaltyTransactionSchema = z.object({
  member_id: z.string().uuid(),
  type: z.enum(['earn', 'redeem', 'adjust', 'expire']),
  points: z.number().int(),
  description: z.string().optional(),
  reference_id: z.string().optional(),
});

export const CreateLoyaltyRewardSchema = z.object({
  program_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  points_cost: z.number().int().min(1),
  reward_type: z.enum(['discount', 'freebie', 'voucher', 'custom']).default('discount'),
  reward_value: z.record(z.unknown()).default({}),
  stock: z.number().int().default(-1),
});

export const UpdateLoyaltyRewardSchema = CreateLoyaltyRewardSchema.partial();

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 5: REFERRAL SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

export const CreateReferralProgramSchema = z.object({
  name: z.string().min(1).max(200),
  referrer_reward_points: z.number().int().min(0).default(100),
  referee_reward_points: z.number().int().min(0).default(50),
  referrer_reward_type: z.enum(['points', 'discount', 'cash', 'custom']).default('points'),
  referee_reward_type: z.enum(['points', 'discount', 'cash', 'custom']).default('points'),
  referrer_reward_value: z.record(z.unknown()).default({}),
  referee_reward_value: z.record(z.unknown()).default({}),
  max_referrals_per_user: z.number().int().min(0).default(0),
});

export const UpdateReferralProgramSchema = CreateReferralProgramSchema.partial();

export const CreateReferralLinkSchema = z.object({
  program_id: z.string().uuid(),
  referrer_id: z.string().uuid(),
  referrer_name: z.string().max(200).optional(),
  referrer_contact: z.string().max(200).optional(),
});

export const RecordReferralSchema = z.object({
  program_id: z.string().uuid(),
  link_id: z.string().uuid().optional(),
  referrer_id: z.string().uuid(),
  referee_contact: z.string().min(1).max(200),
  referee_name: z.string().max(200).optional(),
});

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 6: REVIEW BOOSTER
// ══════════════════════════════════════════════════════════════════════════════

export const CreateReviewCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  google_review_url: z.string().url().optional(),
  delay_after_service_min: z.number().int().min(0).default(60),
  request_channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
  request_template: z.string().min(1),
  positive_redirect_url: z.string().url().optional(),
  negative_followup_template: z.string().optional(),
  min_positive_rating: z.number().int().min(1).max(5).default(4),
});

export const UpdateReviewCampaignSchema = CreateReviewCampaignSchema.partial();

export const CreateReviewRequestSchema = z.object({
  campaign_id: z.string().uuid(),
  contact_value: z.string().min(1).max(200),
  customer_name: z.string().max(200).optional(),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
});

export const SubmitReviewResponseSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 7: SALES PIPELINE CRM
// ══════════════════════════════════════════════════════════════════════════════

export const CreatePipelineSchema = z.object({
  name: z.string().min(1).max(200),
  stages: z.array(z.string().min(1)).min(2).default(['New', 'Contacted', 'Interested', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']),
  is_default: z.boolean().default(false),
});

export const UpdatePipelineSchema = CreatePipelineSchema.partial();

export const CreateDealSchema = z.object({
  pipeline_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  contact_name: z.string().max(200).optional(),
  contact_value: z.string().max(200).optional(),
  stage: z.string().default('New'),
  value: z.number().min(0).default(0),
  currency: z.string().max(3).default('USD'),
  probability: z.number().int().min(0).max(100).default(0),
  assigned_to: z.string().optional(),
  expected_close_date: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const UpdateDealSchema = CreateDealSchema.partial();

export const MoveDealSchema = z.object({
  stage: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

export const LogActivitySchema = z.object({
  deal_id: z.string().uuid(),
  type: z.enum(['note', 'call', 'email', 'meeting', 'task', 'stage_change', 'system']),
  description: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 8: SEGMENTED BROADCAST
// ══════════════════════════════════════════════════════════════════════════════

export const CreateBroadcastSegmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  filter_rules: z.record(z.unknown()),
  is_dynamic: z.boolean().default(true),
});

export const UpdateBroadcastSegmentSchema = CreateBroadcastSegmentSchema.partial();

export const CreateBroadcastCampaignSchema = z.object({
  segment_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
  message_template: z.string().min(1),
  personalization_fields: z.record(z.unknown()).default({}),
  scheduled_at: z.string().optional(),
});

export const UpdateBroadcastCampaignSchema = CreateBroadcastCampaignSchema.partial();

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 9: ADS PERFORMANCE TRACKER
// ══════════════════════════════════════════════════════════════════════════════

export const CreateAdCampaignSchema = z.object({
  platform: z.enum(['facebook', 'google', 'instagram', 'tiktok', 'linkedin', 'other']),
  campaign_name: z.string().min(1).max(300),
  campaign_external_id: z.string().max(200).optional(),
  ad_set_name: z.string().max(300).optional(),
  ad_name: z.string().max(300).optional(),
  budget: z.number().min(0).default(0),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const UpdateAdCampaignSchema = z.object({
  campaign_name: z.string().max(300).optional(),
  spend: z.number().min(0).optional(),
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  budget: z.number().min(0).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  end_date: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const TrackAdConversionSchema = z.object({
  ad_campaign_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
  contact_value: z.string().max(200).optional(),
  conversion_type: z.enum(['lead', 'sale', 'signup', 'call', 'custom']).default('lead'),
  value: z.number().min(0).default(0),
  utm_source: z.string().max(200).optional(),
  utm_medium: z.string().max(200).optional(),
  utm_campaign: z.string().max(200).optional(),
  utm_content: z.string().max(200).optional(),
  landing_page: z.string().optional(),
});

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 10: MINI WEBSITE BUILDER
// ══════════════════════════════════════════════════════════════════════════════

const WebsiteSectionSchema = z.object({
  type: z.enum(['hero', 'features', 'testimonials', 'cta', 'gallery', 'text', 'form', 'faq']),
  content: z.record(z.unknown()).default({}),
  order: z.number().int().default(0),
});

export const CreateMiniWebsiteSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  template: z.enum(['default', 'modern', 'minimal', 'bold']).default('default'),
  hero_title: z.string().optional(),
  hero_subtitle: z.string().optional(),
  hero_image_url: z.string().url().optional(),
  cta_text: z.string().max(100).default('Contact Us'),
  cta_action: z.enum(['whatsapp', 'form', 'link', 'call']).default('whatsapp'),
  cta_value: z.string().optional(),
  sections: z.array(WebsiteSectionSchema).default([]),
  form_fields: z.array(z.object({
    name: z.string(), label: z.string(), type: z.string().default('text'), required: z.boolean().default(false),
  })).default([]),
  whatsapp_widget_enabled: z.boolean().default(true),
  whatsapp_number: z.string().max(20).optional(),
  theme_color: z.string().max(7).default('#6366f1'),
  custom_css: z.string().optional(),
  seo_title: z.string().max(200).optional(),
  seo_description: z.string().optional(),
});

export const UpdateMiniWebsiteSchema = CreateMiniWebsiteSchema.partial();

// ══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════════

export const ListNotificationsQuerySchema = z.object({
  type: z.string().optional(),
  is_read: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
