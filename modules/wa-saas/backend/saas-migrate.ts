/**
 * SaaS extension migration — adds multi-tenant, billing, template,
 * cart-recovery, and conversion tables alongside the existing schema.
 * Called automatically by the server on startup (after the base migrate).
 */
import bcrypt from 'bcryptjs';
import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('saas-migrate');

const saasSql = `
-- ── Tenants ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  slug           VARCHAR(100) NOT NULL UNIQUE,
  plan           VARCHAR(20)  NOT NULL DEFAULT 'trial'
                   CHECK (plan IN ('trial','starter','pro','enterprise')),
  plan_expires_at TIMESTAMPTZ,
  max_numbers    INTEGER NOT NULL DEFAULT 2,
  max_monthly_messages INTEGER NOT NULL DEFAULT 1000,
  custom_domain  VARCHAR(255),
  stripe_customer_id VARCHAR(100),
  setup_fee_paid BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  metadata       JSONB   NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Users (auth) ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255),
  role          VARCHAR(20)  NOT NULL DEFAULT 'member'
                  CHECK (role IN ('superadmin','admin','member')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Subscriptions (Stripe) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_customer_id    VARCHAR(100),
  plan                  VARCHAR(20) NOT NULL,
  status                VARCHAR(30) NOT NULL DEFAULT 'trialing'
                          CHECK (status IN ('active','past_due','canceled','trialing','incomplete','unpaid')),
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  amount                INTEGER NOT NULL DEFAULT 0,
  currency              VARCHAR(10) NOT NULL DEFAULT 'inr',
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tenant WhatsApp numbers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_numbers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_id VARCHAR(100) NOT NULL,
  phone_number    VARCHAR(30),
  display_name    VARCHAR(255),
  access_token    TEXT NOT NULL,
  waba_id         VARCHAR(100),
  verify_token    VARCHAR(255),
  webhook_url     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  messages_sent_this_month INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone_number_id)
);

-- ── WhatsApp approved templates ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waba_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  category       VARCHAR(50)  NOT NULL DEFAULT 'MARKETING'
                   CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  language       VARCHAR(20)  NOT NULL DEFAULT 'en_US',
  status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING','APPROVED','REJECTED','DISABLED')),
  header_type    VARCHAR(20)  CHECK (header_type IN ('TEXT','IMAGE','VIDEO','DOCUMENT','NONE')),
  header_content TEXT,
  body           TEXT NOT NULL,
  footer         TEXT,
  buttons        JSONB NOT NULL DEFAULT '[]',
  variables      JSONB NOT NULL DEFAULT '[]',
  meta_template_id VARCHAR(100),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── E-commerce cart recovery sessions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  shop_domain      VARCHAR(255) NOT NULL,
  cart_token       VARCHAR(255) NOT NULL,
  customer_phone   VARCHAR(30),
  customer_email   VARCHAR(255),
  customer_name    VARCHAR(255),
  cart_value       DECIMAL(12,2) DEFAULT 0,
  currency         VARCHAR(10)  DEFAULT 'INR',
  items            JSONB NOT NULL DEFAULT '[]',
  checkout_url     TEXT,
  status           VARCHAR(20)  NOT NULL DEFAULT 'abandoned'
                     CHECK (status IN ('abandoned','recovered','expired')),
  first_message_sent_at  TIMESTAMPTZ,
  followup_sent_at       TIMESTAMPTZ,
  recovered_at           TIMESTAMPTZ,
  recovery_order_id      VARCHAR(255),
  recovery_value         DECIMAL(12,2),
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, cart_token)
);

-- ── Conversion tracking ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id          UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  cart_session_id      UUID REFERENCES cart_sessions(id) ON DELETE SET NULL,
  lead_id              UUID REFERENCES leads(id) ON DELETE SET NULL,
  channel              VARCHAR(20)  NOT NULL,
  contact_value        VARCHAR(255) NOT NULL,
  conversion_type      VARCHAR(50)  NOT NULL DEFAULT 'purchase',
  order_id             VARCHAR(255),
  order_value          DECIMAL(12,2),
  currency             VARCHAR(10)  DEFAULT 'INR',
  attributed_message_id UUID,
  metadata             JSONB NOT NULL DEFAULT '{}',
  converted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inbound webhook events log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       VARCHAR(50)  NOT NULL,
  event_type   VARCHAR(100) NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}',
  processed    BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_slug         ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active        ON tenants(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant          ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant  ON subscriptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_numbers_tenant ON tenant_numbers(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_waba_templates_tenant ON waba_templates(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_status  ON cart_sessions(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_token   ON cart_sessions(cart_token);
CREATE INDEX IF NOT EXISTS idx_conversions_tenant    ON conversions(tenant_id, converted_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversions_campaign  ON conversions(campaign_id, converted_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_proc   ON webhook_events(processed, created_at DESC);
`;

async function seedDefaultAdmin(): Promise<void> {
  // Create default agency tenant if it doesn't exist
  const tenantRes = await pool.query<{ id: string }>(
    `INSERT INTO tenants (name, slug, plan)
     VALUES ('Agency', 'agency', 'enterprise')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  const tenantId = tenantRes.rows[0].id;

  // Check if admin user already exists
  const existingUser = await pool.query(
    `SELECT id FROM users WHERE email = 'admin@msgcrm.com'`
  );
  if (existingUser.rows.length > 0) return;

  const passwordHash = await bcrypt.hash('Admin@1234', 12);
  await pool.query(
    `INSERT INTO users (tenant_id, email, password_hash, full_name, role)
     VALUES ($1, 'admin@msgcrm.com', $2, 'Super Admin', 'superadmin')
     ON CONFLICT (email) DO NOTHING`,
    [tenantId, passwordHash]
  );
  log.info('Default admin seeded — email: admin@msgcrm.com');
}

export async function saasMigrate(): Promise<void> {
  try {
    await pool.query(saasSql);
    log.info('SaaS schema migration complete');
    await seedDefaultAdmin();
  } catch (err) {
    log.error('SaaS migration failed', err);
    throw err;
  }
}

// ── WA-SaaS module tables (drip, ai-bot, orders, subscriptions, flash-sales, team-inbox, links, re-engagement) ──
const waSaasSql = `
-- Drip Marketing
CREATE TABLE IF NOT EXISTS wa_drip_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  trigger_type    VARCHAR(50)  NOT NULL DEFAULT 'manual',
  trigger_config  JSONB NOT NULL DEFAULT '{}',
  segment_filter  JSONB NOT NULL DEFAULT '{}',
  stop_on_reply   BOOLEAN NOT NULL DEFAULT true,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  enrolled_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_drip_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id   UUID NOT NULL REFERENCES wa_drip_campaigns(id) ON DELETE CASCADE,
  step_order    INTEGER NOT NULL DEFAULT 1,
  delay_days    INTEGER NOT NULL DEFAULT 0,
  delay_hours   INTEGER NOT NULL DEFAULT 0,
  message_type  VARCHAR(30) NOT NULL DEFAULT 'text',
  template_name VARCHAR(255),
  message_body  TEXT,
  media_url     TEXT,
  buttons       JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_drip_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES wa_drip_campaigns(id) ON DELETE CASCADE,
  contact_phone   VARCHAR(30) NOT NULL,
  contact_name    VARCHAR(255),
  current_step    INTEGER NOT NULL DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','completed','stopped')),
  next_action_at  TIMESTAMPTZ,
  enrolled_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  stopped_reason  TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_drip_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  enrollment_id   UUID REFERENCES wa_drip_enrollments(id) ON DELETE SET NULL,
  campaign_id     UUID REFERENCES wa_drip_campaigns(id) ON DELETE SET NULL,
  step_order      INTEGER,
  status          VARCHAR(20) NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent','failed','skipped')),
  wa_message_id   VARCHAR(255),
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AI Auto-Reply Bot
CREATE TABLE IF NOT EXISTS wa_ai_bot_configs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                    VARCHAR(255) NOT NULL,
  model                   VARCHAR(100) NOT NULL DEFAULT 'gpt-3.5-turbo',
  system_prompt           TEXT,
  temperature             DECIMAL(3,2) NOT NULL DEFAULT 0.7,
  max_tokens              INTEGER NOT NULL DEFAULT 500,
  human_takeover_enabled  BOOLEAN NOT NULL DEFAULT true,
  takeover_keywords       TEXT[],
  business_hours          JSONB NOT NULL DEFAULT '{}',
  fallback_message        TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_ai_faq_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bot_config_id   UUID REFERENCES wa_ai_bot_configs(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  keywords        TEXT[],
  priority        INTEGER NOT NULL DEFAULT 0,
  hit_count       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_ai_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_phone     VARCHAR(30),
  status            VARCHAR(20) NOT NULL DEFAULT 'bot'
                      CHECK (status IN ('bot','human','closed')),
  last_message_at   TIMESTAMPTZ DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_ai_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id   UUID REFERENCES wa_ai_conversations(id) ON DELETE CASCADE,
  suggestion_text   TEXT,
  accepted          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Order Tracking
CREATE TABLE IF NOT EXISTS wa_order_configs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                        VARCHAR(255) NOT NULL,
  shipping_provider           VARCHAR(100),
  notify_on_shipped           BOOLEAN NOT NULL DEFAULT true,
  notify_on_out_for_delivery  BOOLEAN NOT NULL DEFAULT true,
  notify_on_delivered         BOOLEAN NOT NULL DEFAULT true,
  notify_on_delay             BOOLEAN NOT NULL DEFAULT true,
  delay_threshold_hours       INTEGER NOT NULL DEFAULT 24,
  message_templates           JSONB NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_id            UUID REFERENCES wa_order_configs(id) ON DELETE SET NULL,
  order_number         VARCHAR(100) NOT NULL,
  customer_phone       VARCHAR(30) NOT NULL,
  customer_name        VARCHAR(255),
  tracking_number      VARCHAR(255),
  tracking_url         TEXT,
  carrier              VARCHAR(100),
  estimated_delivery   TIMESTAMPTZ,
  status               VARCHAR(30) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','shipped','out_for_delivery','delivered','failed','returned')),
  notification_count   INTEGER NOT NULL DEFAULT 0,
  last_notified_status VARCHAR(50),
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_order_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES wa_orders(id) ON DELETE CASCADE,
  event_type  VARCHAR(50) NOT NULL,
  description TEXT,
  location    VARCHAR(255),
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Bot
CREATE TABLE IF NOT EXISTS wa_subscription_plans (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  description          TEXT,
  price                DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency             VARCHAR(10)  NOT NULL DEFAULT 'INR',
  billing_cycle        VARCHAR(20)  NOT NULL DEFAULT 'monthly'
                         CHECK (billing_cycle IN ('weekly','monthly','quarterly','yearly')),
  grace_period_days    INTEGER NOT NULL DEFAULT 3,
  reminder_days_before INTEGER NOT NULL DEFAULT 3,
  auto_pause_on_fail   BOOLEAN NOT NULL DEFAULT true,
  subscriber_count     INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES wa_subscription_plans(id) ON DELETE CASCADE,
  customer_phone        VARCHAR(30) NOT NULL,
  customer_name         VARCHAR(255),
  customer_email        VARCHAR(255),
  payment_method        JSONB NOT NULL DEFAULT '{}',
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','paused','cancelled','expired')),
  current_period_start  TIMESTAMPTZ DEFAULT NOW(),
  current_period_end    TIMESTAMPTZ,
  next_billing_at       TIMESTAMPTZ,
  paused_at             TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  total_paid            DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_subscription_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id  UUID NOT NULL REFERENCES wa_subscriptions(id) ON DELETE CASCADE,
  amount           DECIMAL(12,2) NOT NULL,
  currency         VARCHAR(10) NOT NULL DEFAULT 'INR',
  payment_ref      VARCHAR(255),
  status           VARCHAR(20) NOT NULL DEFAULT 'paid',
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Flash Sales
CREATE TABLE IF NOT EXISTS wa_flash_sales (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  description          TEXT,
  offer_text           TEXT,
  discount_code        VARCHAR(100),
  starts_at            TIMESTAMPTZ,
  ends_at              TIMESTAMPTZ,
  segment_filter       JSONB NOT NULL DEFAULT '{}',
  send_countdown       BOOLEAN NOT NULL DEFAULT false,
  countdown_intervals  INTEGER[] DEFAULT '{}',
  final_reminder_min   INTEGER NOT NULL DEFAULT 60,
  template_name        VARCHAR(255),
  media_url            TEXT,
  status               VARCHAR(20) NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','active','paused','ended','cancelled')),
  sent_count           INTEGER NOT NULL DEFAULT 0,
  click_count          INTEGER NOT NULL DEFAULT 0,
  conversion_count     INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_flash_sale_recipients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id      UUID NOT NULL REFERENCES wa_flash_sales(id) ON DELETE CASCADE,
  contact_phone VARCHAR(30),
  contact_name  VARCHAR(255),
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  clicked      BOOLEAN NOT NULL DEFAULT false,
  converted    BOOLEAN NOT NULL DEFAULT false
);

-- Team Inbox
CREATE TABLE IF NOT EXISTS wa_team_agents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  email          VARCHAR(255),
  role           VARCHAR(30) NOT NULL DEFAULT 'agent',
  max_concurrent INTEGER NOT NULL DEFAULT 5,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  is_online      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_team_conversations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assigned_agent_id    UUID REFERENCES wa_team_agents(id) ON DELETE SET NULL,
  contact_phone        VARCHAR(30),
  contact_name         VARCHAR(255),
  status               VARCHAR(20) NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open','resolved','closed')),
  priority             VARCHAR(20) NOT NULL DEFAULT 'normal'
                         CHECK (priority IN ('low','normal','high','urgent')),
  tags                 TEXT[] DEFAULT '{}',
  last_message_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT,
  message_count        INTEGER NOT NULL DEFAULT 0,
  first_response_at    TIMESTAMPTZ,
  resolved_at          TIMESTAMPTZ,
  sla_deadline         TIMESTAMPTZ,
  sla_breached         BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_team_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES wa_team_conversations(id) ON DELETE CASCADE,
  direction        VARCHAR(10) NOT NULL DEFAULT 'inbound'
                     CHECK (direction IN ('inbound','outbound')),
  sender_type      VARCHAR(20) NOT NULL DEFAULT 'customer'
                     CHECK (sender_type IN ('customer','agent','bot')),
  sender_id        VARCHAR(255),
  body             TEXT,
  message_type     VARCHAR(20) NOT NULL DEFAULT 'text',
  media_url        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_team_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES wa_team_conversations(id) ON DELETE CASCADE,
  agent_id         UUID REFERENCES wa_team_agents(id) ON DELETE SET NULL,
  note             TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Link Tracking
CREATE TABLE IF NOT EXISTS wa_tracked_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  original_url  TEXT NOT NULL,
  short_code    VARCHAR(20) NOT NULL UNIQUE,
  campaign_ref  VARCHAR(255),
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  total_clicks  INTEGER NOT NULL DEFAULT 0,
  unique_clicks INTEGER NOT NULL DEFAULT 0,
  conversions   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_link_clicks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  link_id        UUID NOT NULL REFERENCES wa_tracked_links(id) ON DELETE CASCADE,
  contact_phone  VARCHAR(30),
  ip_address     VARCHAR(45),
  user_agent     TEXT,
  referer        TEXT,
  converted      BOOLEAN NOT NULL DEFAULT false,
  conversion_value DECIMAL(12,2),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Re-engagement
CREATE TABLE IF NOT EXISTS wa_reengagement_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  inactivity_days  INTEGER NOT NULL DEFAULT 30,
  segment_filter   JSONB NOT NULL DEFAULT '{}',
  message_type     VARCHAR(30) NOT NULL DEFAULT 'text',
  template_name    VARCHAR(255),
  message_body     TEXT,
  offer_code       VARCHAR(100),
  media_url        TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT false,
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','active','paused','completed')),
  sent_count       INTEGER NOT NULL DEFAULT 0,
  reengaged_count  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_reengagement_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id  UUID NOT NULL REFERENCES wa_reengagement_campaigns(id) ON DELETE CASCADE,
  contact_phone VARCHAR(30),
  contact_name  VARCHAR(255),
  sent_at      TIMESTAMPTZ DEFAULT NOW(),
  responded    BOOLEAN NOT NULL DEFAULT false
);

-- Broadcast Optimizer
CREATE TABLE IF NOT EXISTS wa_broadcast_optimizer_configs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                     VARCHAR(255) NOT NULL,
  smart_timing_enabled     BOOLEAN NOT NULL DEFAULT false,
  timezone                 VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  preferred_hours          INTEGER[] DEFAULT '{}',
  rate_limit_per_sec       INTEGER NOT NULL DEFAULT 5,
  rate_limit_per_min       INTEGER NOT NULL DEFAULT 60,
  template_rotation_enabled BOOLEAN NOT NULL DEFAULT false,
  templates                JSONB NOT NULL DEFAULT '[]',
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_broadcast_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  config_id       UUID REFERENCES wa_broadcast_optimizer_configs(id) ON DELETE SET NULL,
  name            VARCHAR(255) NOT NULL,
  template_name   VARCHAR(255),
  message_body    TEXT,
  segment_filter  JSONB NOT NULL DEFAULT '{}',
  scheduled_at    TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','running','completed','failed','cancelled')),
  total_count     INTEGER NOT NULL DEFAULT 0,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Digital Business Card Bot
CREATE TABLE IF NOT EXISTS wa_business_cards (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  business_name        VARCHAR(255),
  tagline              TEXT,
  description          TEXT,
  phone                VARCHAR(30),
  email                VARCHAR(255),
  website_url          TEXT,
  address              TEXT,
  location_lat         DECIMAL(10,7),
  location_lng         DECIMAL(10,7),
  services             JSONB NOT NULL DEFAULT '[]',
  social_links         JSONB NOT NULL DEFAULT '{}',
  logo_url             TEXT,
  cover_url            TEXT,
  interactive_buttons  JSONB NOT NULL DEFAULT '[]',
  lead_capture_enabled BOOLEAN NOT NULL DEFAULT false,
  lead_capture_fields  TEXT[],
  trigger_keyword      VARCHAR(100),
  is_active            BOOLEAN NOT NULL DEFAULT false,
  view_count           INTEGER NOT NULL DEFAULT 0,
  lead_count           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_business_card_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  card_id        UUID NOT NULL REFERENCES wa_business_cards(id) ON DELETE CASCADE,
  contact_phone  VARCHAR(30),
  contact_name   VARCHAR(255),
  data           JSONB NOT NULL DEFAULT '{}',
  source         VARCHAR(50),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- WA-SaaS Notifications
CREATE TABLE IF NOT EXISTS wa_saas_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module      VARCHAR(50),
  type        VARCHAR(100),
  title       VARCHAR(255) NOT NULL,
  message     TEXT,
  severity    VARCHAR(20) NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info','success','warning','error')),
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wa_drip_campaigns_tenant  ON wa_drip_campaigns(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_wa_drip_enrollments_due   ON wa_drip_enrollments(status, next_action_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wa_drip_logs_tenant       ON wa_drip_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_ai_bot_tenant          ON wa_ai_bot_configs(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_wa_orders_tenant          ON wa_orders(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_subscriptions_tenant   ON wa_subscriptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_flash_sales_active     ON wa_flash_sales(status, starts_at, ends_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wa_team_convs_tenant      ON wa_team_conversations(tenant_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_team_convs_agent       ON wa_team_conversations(assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_team_messages_conv     ON wa_team_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_wa_tracked_links_code     ON wa_tracked_links(short_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_wa_link_clicks_link       ON wa_link_clicks(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_reengagement_tenant    ON wa_reengagement_campaigns(tenant_id, status);
`;

export async function waSaasMigrate(): Promise<void> {
  try {
    await pool.query(waSaasSql);
    log.info('WA-SaaS module schema migration complete');
  } catch (err) {
    log.error('WA-SaaS migration failed', err);
    throw err;
  }
}
