/**
 * Instagram Automation & Content System migration.
 *
 * Tables:
 *   - instagram_accounts         (connected IG business accounts per tenant)
 *   - instagram_messages         (DM inbox messages in/out)
 *   - instagram_comments         (tracked post comments)
 *   - instagram_comment_rules    (comment-to-DM automation rules)
 *   - instagram_story_rules      (story-reply automation rules)
 *   - instagram_lead_bot_configs (multi-step lead qualification bot)
 *   - instagram_leads            (captured leads)
 *   - instagram_content          (content studio: clips, captions, schedules)
 *   - instagram_automation_logs  (unified audit log)
 */
import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('instagram-migrate');

const instagramSql = `

-- ── Instagram Accounts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ig_user_id       VARCHAR(100) NOT NULL,
  ig_username      VARCHAR(255) NOT NULL,
  access_token     TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  page_id          VARCHAR(100),
  page_access_token TEXT,
  profile_pic_url  TEXT,
  followers_count  INTEGER DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  webhook_verified BOOLEAN NOT NULL DEFAULT false,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, ig_user_id)
);

-- ── Instagram Messages (DM Inbox) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id        UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  ig_message_id     VARCHAR(255),
  ig_conversation_id VARCHAR(255),
  sender_id         VARCHAR(100) NOT NULL,
  sender_username   VARCHAR(255),
  recipient_id      VARCHAR(100) NOT NULL,
  direction         VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type      VARCHAR(30) NOT NULL DEFAULT 'text'
                      CHECK (message_type IN ('text','image','video','story_reply','story_mention','link','reaction')),
  body              TEXT,
  media_url         TEXT,
  ig_post_id        VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'received'
                      CHECK (status IN ('received','sent','delivered','read','failed')),
  rule_id           UUID,
  is_automated      BOOLEAN NOT NULL DEFAULT false,
  error_message     TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Instagram Comments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  ig_comment_id   VARCHAR(255) NOT NULL,
  ig_media_id     VARCHAR(255) NOT NULL,
  ig_user_id      VARCHAR(100) NOT NULL,
  username        VARCHAR(255),
  text            TEXT NOT NULL,
  parent_id       VARCHAR(255),
  timestamp       TIMESTAMPTZ NOT NULL,
  dm_sent         BOOLEAN NOT NULL DEFAULT false,
  rule_id         UUID,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, ig_comment_id)
);

-- ── Comment-to-DM Automation Rules ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_comment_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  ig_media_id      VARCHAR(255),
  ig_media_url     TEXT,
  keywords         TEXT[] NOT NULL DEFAULT '{}',
  match_type       VARCHAR(20) NOT NULL DEFAULT 'any'
                     CHECK (match_type IN ('any','all','exact','regex')),
  dm_template      TEXT NOT NULL,
  dm_template_b    TEXT,
  ab_split         INTEGER DEFAULT 100,
  delay_min_sec    INTEGER NOT NULL DEFAULT 0,
  delay_max_sec    INTEGER NOT NULL DEFAULT 0,
  enable_tracking  BOOLEAN NOT NULL DEFAULT true,
  auto_tag         TEXT[] NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  trigger_count    INTEGER NOT NULL DEFAULT 0,
  dm_sent_count    INTEGER NOT NULL DEFAULT 0,
  click_count      INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Story Reply Automation Rules ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_story_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  trigger_type     VARCHAR(30) NOT NULL DEFAULT 'story_reply'
                     CHECK (trigger_type IN ('story_reply','story_mention','poll_response')),
  keywords         TEXT[] NOT NULL DEFAULT '{}',
  match_type       VARCHAR(20) NOT NULL DEFAULT 'any'
                     CHECK (match_type IN ('any','all','exact','regex')),
  dm_template      TEXT NOT NULL,
  dm_template_b    TEXT,
  ab_split         INTEGER DEFAULT 100,
  delay_min_sec    INTEGER NOT NULL DEFAULT 0,
  delay_max_sec    INTEGER NOT NULL DEFAULT 0,
  followup_template TEXT,
  followup_delay_sec INTEGER DEFAULT 0,
  auto_tag         TEXT[] NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  trigger_count    INTEGER NOT NULL DEFAULT 0,
  dm_sent_count    INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Lead Qualification Bot ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_lead_bot_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  steps            JSONB NOT NULL DEFAULT '[]',
  welcome_message  TEXT NOT NULL DEFAULT 'Hi! Let me help you get started.',
  completion_message TEXT DEFAULT 'Thanks! We will be in touch soon.',
  scoring_rules    JSONB NOT NULL DEFAULT '{}',
  auto_assign_to   VARCHAR(255),
  send_to_whatsapp BOOLEAN NOT NULL DEFAULT false,
  whatsapp_number  VARCHAR(30),
  google_sheet_id  TEXT,
  google_sheet_tab TEXT,
  recovery_message TEXT,
  recovery_delay_hours INTEGER DEFAULT 24,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  leads_captured   INTEGER NOT NULL DEFAULT 0,
  hot_leads        INTEGER NOT NULL DEFAULT 0,
  drop_offs        INTEGER NOT NULL DEFAULT 0,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Instagram Leads (captured via lead bot) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_leads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  bot_config_id    UUID REFERENCES instagram_lead_bot_configs(id) ON DELETE SET NULL,
  ig_user_id       VARCHAR(100) NOT NULL,
  ig_username      VARCHAR(255),
  name             VARCHAR(255),
  phone            VARCHAR(30),
  email            VARCHAR(255),
  budget           VARCHAR(100),
  timeline         VARCHAR(100),
  current_step     INTEGER NOT NULL DEFAULT 0,
  answers          JSONB NOT NULL DEFAULT '{}',
  score            INTEGER NOT NULL DEFAULT 0,
  segment          VARCHAR(20) NOT NULL DEFAULT 'cold'
                     CHECK (segment IN ('hot','warm','cold')),
  status           VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress','completed','dropped','recovered')),
  assigned_to      VARCHAR(255),
  tags             TEXT[] NOT NULL DEFAULT '{}',
  sent_to_whatsapp BOOLEAN NOT NULL DEFAULT false,
  sent_to_sheets   BOOLEAN NOT NULL DEFAULT false,
  recovered_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Content Studio ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_content (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  content_type     VARCHAR(30) NOT NULL DEFAULT 'post'
                     CHECK (content_type IN ('post','reel','story','carousel')),
  caption          TEXT,
  hashtags         TEXT[] NOT NULL DEFAULT '{}',
  media_urls       TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_url    TEXT,
  ig_media_id      VARCHAR(255),
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','scheduled','publishing','published','failed')),
  scheduled_at     TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  platforms        TEXT[] NOT NULL DEFAULT '{instagram}',
  engagement       JSONB NOT NULL DEFAULT '{"likes":0,"comments":0,"shares":0,"saves":0,"reach":0,"impressions":0}',
  error_message    TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Automation Logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_automation_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id       UUID REFERENCES instagram_accounts(id) ON DELETE SET NULL,
  log_type         VARCHAR(30) NOT NULL
                     CHECK (log_type IN ('comment_dm','story_dm','lead_step','lead_complete',
                                         'content_publish','lead_recovery','followup','error')),
  rule_id          UUID,
  lead_id          UUID,
  content_id       UUID,
  ig_user_id       VARCHAR(100),
  ig_username      VARCHAR(255),
  message          TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'success'
                     CHECK (status IN ('success','failed','skipped')),
  error_detail     TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ig_accounts_tenant        ON instagram_accounts(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ig_messages_tenant         ON instagram_messages(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_messages_account        ON instagram_messages(account_id, direction, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_messages_conversation   ON instagram_messages(ig_conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ig_messages_sender         ON instagram_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_comments_tenant         ON instagram_comments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_comments_media          ON instagram_comments(ig_media_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_comments_account        ON instagram_comments(account_id, dm_sent);
CREATE INDEX IF NOT EXISTS idx_ig_comment_rules_tenant    ON instagram_comment_rules(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ig_comment_rules_media     ON instagram_comment_rules(ig_media_id);
CREATE INDEX IF NOT EXISTS idx_ig_story_rules_tenant      ON instagram_story_rules(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ig_lead_bot_tenant         ON instagram_lead_bot_configs(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ig_leads_tenant            ON instagram_leads(tenant_id, segment, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_leads_bot               ON instagram_leads(bot_config_id, status);
CREATE INDEX IF NOT EXISTS idx_ig_leads_ig_user           ON instagram_leads(ig_user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_ig_content_tenant          ON instagram_content(tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ig_content_account         ON instagram_content(account_id, status);
CREATE INDEX IF NOT EXISTS idx_ig_content_scheduled       ON instagram_content(status, scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_ig_automation_logs_tenant  ON instagram_automation_logs(tenant_id, log_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ig_automation_logs_rule    ON instagram_automation_logs(rule_id, created_at DESC);
`;

export async function instagramMigrate(): Promise<void> {
  try {
    await pool.query(instagramSql);
    log.info('Instagram schema migration complete');
  } catch (err) {
    log.error('Instagram migration failed', err);
    throw err;
  }
}
