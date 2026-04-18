import { z } from 'zod';

// ── Instagram Account ────────────────────────────────────────────────────────

export const ConnectInstagramSchema = z.object({
  igUserId: z.string().min(1),
  igUsername: z.string().min(1),
  accessToken: z.string().min(1),
  tokenExpiresAt: z.string().datetime().optional(),
  pageId: z.string().optional(),
  pageAccessToken: z.string().optional(),
  profilePicUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateInstagramAccountSchema = z.object({
  accessToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  pageAccessToken: z.string().optional(),
  profilePicUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ── Comment-to-DM Rule ──────────────────────────────────────────────────────

export const CreateCommentRuleSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(255),
  igMediaId: z.string().optional(),
  igMediaUrl: z.string().url().optional(),
  keywords: z.array(z.string()).min(1),
  matchType: z.enum(['any', 'all', 'exact', 'regex']).default('any'),
  dmTemplate: z.string().min(1),
  dmTemplateB: z.string().optional(),
  abSplit: z.number().int().min(0).max(100).default(100),
  delayMinSec: z.number().int().min(0).default(0),
  delayMaxSec: z.number().int().min(0).default(0),
  enableTracking: z.boolean().default(true),
  autoTag: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateCommentRuleSchema = CreateCommentRuleSchema.partial().omit({ accountId: true });

// ── Story Reply Rule ────────────────────────────────────────────────────────

export const CreateStoryRuleSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(255),
  triggerType: z.enum(['story_reply', 'story_mention', 'poll_response']).default('story_reply'),
  keywords: z.array(z.string()).default([]),
  matchType: z.enum(['any', 'all', 'exact', 'regex']).default('any'),
  dmTemplate: z.string().min(1),
  dmTemplateB: z.string().optional(),
  abSplit: z.number().int().min(0).max(100).default(100),
  delayMinSec: z.number().int().min(0).default(0),
  delayMaxSec: z.number().int().min(0).default(0),
  followupTemplate: z.string().optional(),
  followupDelaySec: z.number().int().min(0).default(0),
  autoTag: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateStoryRuleSchema = CreateStoryRuleSchema.partial().omit({ accountId: true });

// ── Lead Bot Config ─────────────────────────────────────────────────────────

export const LeadBotStepSchema = z.object({
  order: z.number().int().min(0),
  question: z.string().min(1),
  field: z.string().min(1),
  type: z.enum(['text', 'choice', 'phone', 'email', 'budget', 'timeline']),
  options: z.array(z.string()).optional(),
  validation: z.string().optional(),
  scoreMap: z.record(z.number()).optional(),
});

export const CreateLeadBotConfigSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(255),
  steps: z.array(LeadBotStepSchema).min(1),
  welcomeMessage: z.string().default('Hi! Let me help you get started.'),
  completionMessage: z.string().optional(),
  scoringRules: z.record(z.unknown()).optional(),
  autoAssignTo: z.string().optional(),
  sendToWhatsapp: z.boolean().default(false),
  whatsappNumber: z.string().optional(),
  googleSheetId: z.string().optional(),
  googleSheetTab: z.string().optional(),
  recoveryMessage: z.string().optional(),
  recoveryDelayHours: z.number().int().min(1).default(24),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateLeadBotConfigSchema = CreateLeadBotConfigSchema.partial().omit({ accountId: true });

// ── Content Studio ──────────────────────────────────────────────────────────

export const CreateContentSchema = z.object({
  accountId: z.string().uuid(),
  contentType: z.enum(['post', 'reel', 'story', 'carousel']).default('post'),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
  mediaUrls: z.array(z.string().url()).default([]),
  thumbnailUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
  platforms: z.array(z.string()).default(['instagram']),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateContentSchema = z.object({
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  thumbnailUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed']).optional(),
  platforms: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ── Shared Interfaces ───────────────────────────────────────────────────────

export interface InstagramAccount {
  id: string;
  tenant_id: string;
  ig_user_id: string;
  ig_username: string;
  access_token: string;
  token_expires_at: string | null;
  page_id: string | null;
  page_access_token: string | null;
  profile_pic_url: string | null;
  followers_count: number;
  is_active: boolean;
  webhook_verified: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InstagramMessage {
  id: string;
  tenant_id: string;
  account_id: string;
  ig_message_id: string | null;
  ig_conversation_id: string | null;
  sender_id: string;
  sender_username: string | null;
  recipient_id: string;
  direction: 'inbound' | 'outbound';
  message_type: string;
  body: string | null;
  media_url: string | null;
  ig_post_id: string | null;
  status: string;
  rule_id: string | null;
  is_automated: boolean;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InstagramComment {
  id: string;
  tenant_id: string;
  account_id: string;
  ig_comment_id: string;
  ig_media_id: string;
  ig_user_id: string;
  username: string | null;
  text: string;
  parent_id: string | null;
  timestamp: string;
  dm_sent: boolean;
  rule_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InstagramCommentRule {
  id: string;
  tenant_id: string;
  account_id: string;
  name: string;
  ig_media_id: string | null;
  ig_media_url: string | null;
  keywords: string[];
  match_type: string;
  dm_template: string;
  dm_template_b: string | null;
  ab_split: number;
  delay_min_sec: number;
  delay_max_sec: number;
  enable_tracking: boolean;
  auto_tag: string[];
  is_active: boolean;
  trigger_count: number;
  dm_sent_count: number;
  click_count: number;
  last_triggered_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InstagramStoryRule {
  id: string;
  tenant_id: string;
  account_id: string;
  name: string;
  trigger_type: string;
  keywords: string[];
  match_type: string;
  dm_template: string;
  dm_template_b: string | null;
  ab_split: number;
  delay_min_sec: number;
  delay_max_sec: number;
  followup_template: string | null;
  followup_delay_sec: number;
  auto_tag: string[];
  is_active: boolean;
  trigger_count: number;
  dm_sent_count: number;
  last_triggered_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InstagramLeadBotConfig {
  id: string;
  tenant_id: string;
  account_id: string;
  name: string;
  steps: Array<{ order: number; question: string; field: string; type: string; options?: string[]; validation?: string; scoreMap?: Record<string, number> }>;
  welcome_message: string;
  completion_message: string | null;
  scoring_rules: Record<string, unknown>;
  auto_assign_to: string | null;
  send_to_whatsapp: boolean;
  whatsapp_number: string | null;
  google_sheet_id: string | null;
  google_sheet_tab: string | null;
  recovery_message: string | null;
  recovery_delay_hours: number;
  is_active: boolean;
  leads_captured: number;
  hot_leads: number;
  drop_offs: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InstagramLead {
  id: string;
  tenant_id: string;
  account_id: string;
  bot_config_id: string | null;
  ig_user_id: string;
  ig_username: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  budget: string | null;
  timeline: string | null;
  current_step: number;
  answers: Record<string, unknown>;
  score: number;
  segment: 'hot' | 'warm' | 'cold';
  status: 'in_progress' | 'completed' | 'dropped' | 'recovered';
  assigned_to: string | null;
  tags: string[];
  sent_to_whatsapp: boolean;
  sent_to_sheets: boolean;
  recovered_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InstagramContent {
  id: string;
  tenant_id: string;
  account_id: string;
  content_type: string;
  caption: string | null;
  hashtags: string[];
  media_urls: string[];
  thumbnail_url: string | null;
  ig_media_id: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  platforms: string[];
  engagement: { likes: number; comments: number; shares: number; saves: number; reach: number; impressions: number };
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InstagramAutomationLog {
  id: string;
  tenant_id: string;
  account_id: string | null;
  log_type: string;
  rule_id: string | null;
  lead_id: string | null;
  content_id: string | null;
  ig_user_id: string | null;
  ig_username: string | null;
  message: string | null;
  status: string;
  error_detail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
