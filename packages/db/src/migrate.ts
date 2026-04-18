import { pool } from './connection';
import { createLogger } from '../../utils/src/logger';
import { config } from '../../config/src/config';

const log = createLogger('migrate');

const schema = `
CREATE TABLE IF NOT EXISTS provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram')),
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  cost_per_msg DECIMAL(10, 4) DEFAULT 0,
  rate_per_sec INTEGER DEFAULT 10,
  daily_limit INTEGER DEFAULT 0,
  credentials JSONB DEFAULT '{}',
  extra_config JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'unchecked' CHECK (status IN ('connected', 'failed', 'unchecked', 'paused')),
  status_message TEXT,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel, name)
);

CREATE TABLE IF NOT EXISTS whatsapp_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_config_id UUID REFERENCES provider_configs(id) ON DELETE CASCADE,
  phone_number_id VARCHAR(100) NOT NULL UNIQUE,
  webhook_url TEXT,
  verify_token VARCHAR(255),
  business_account_id VARCHAR(100),
  is_registered BOOLEAN DEFAULT false,
  registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram')),
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  cost_per_msg DECIMAL(10, 4) DEFAULT 0,
  success_rate DECIMAL(5, 2) DEFAULT 100.00,
  daily_limit INTEGER DEFAULT 0,
  daily_sent INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel, name)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram')),
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 0,
  template_id VARCHAR(100),
  message_body TEXT,
  subject VARCHAR(500),
  provider_chain TEXT[] DEFAULT '{}',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  template_id VARCHAR(100),
  template_params JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'read')),
  provider_used VARCHAR(50),
  provider_msg_id VARCHAR(255),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  cost DECIMAL(10, 4) DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  sender_id VARCHAR(10),
  dlt_template_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed')),
  provider_used VARCHAR(50),
  provider_msg_id VARCHAR(255),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  cost DECIMAL(10, 4) DEFAULT 0,
  region VARCHAR(50),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  to_email VARCHAR(255) NOT NULL,
  from_email VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  html_body TEXT,
  text_body TEXT,
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  provider_used VARCHAR(50),
  provider_msg_id VARCHAR(255),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  cost DECIMAL(10, 4) DEFAULT 0,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS failed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(20) NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  message_id UUID,
  recipient VARCHAR(255) NOT NULL,
  message_body TEXT,
  providers_tried TEXT[],
  last_error TEXT,
  attempts INTEGER DEFAULT 0,
  can_retry BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram')),
  message_id UUID,
  recipient VARCHAR(255),
  provider VARCHAR(100),
  error_message TEXT NOT NULL,
  retryable BOOLEAN DEFAULT true,
  resolved BOOLEAN DEFAULT false,
  retried_at TIMESTAMPTZ,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_configs_channel_status ON provider_configs(channel, status, is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhooks_phone ON whatsapp_webhooks(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_campaign_errors_campaign_resolved ON campaign_errors(campaign_id, resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_channel_status ON campaigns(channel, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_priority ON campaigns(priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign ON whatsapp_messages(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sent_at ON whatsapp_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_sms_campaign ON sms_messages(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_sms_phone ON sms_messages(phone);
CREATE INDEX IF NOT EXISTS idx_sms_sent_at ON sms_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_campaign ON email_messages(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_email_to ON email_messages(to_email);
CREATE INDEX IF NOT EXISTS idx_email_sent_at ON email_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_failed_channel ON failed_messages(channel, can_retry);

-- Dynamic provider configuration (admin-managed)
CREATE TABLE IF NOT EXISTS provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram')),
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  cost_per_msg DECIMAL(10, 4) DEFAULT 0,
  rate_per_sec INTEGER DEFAULT 10,
  daily_limit INTEGER DEFAULT 0,
  credentials JSONB NOT NULL DEFAULT '{}',
  extra_config JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'unchecked' CHECK (status IN ('connected', 'failed', 'unchecked', 'paused')),
  status_message TEXT,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel, name)
);

-- WhatsApp webhook registration tracker
CREATE TABLE IF NOT EXISTS whatsapp_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_config_id UUID REFERENCES provider_configs(id) ON DELETE CASCADE,
  phone_number_id VARCHAR(100) NOT NULL,
  webhook_url TEXT,
  verify_token VARCHAR(255),
  business_account_id VARCHAR(100),
  is_registered BOOLEAN DEFAULT false,
  registered_at TIMESTAMPTZ,
  UNIQUE(phone_number_id)
);

-- Campaign error events (per-message error log)
CREATE TABLE IF NOT EXISTS campaign_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  message_id UUID,
  recipient VARCHAR(255),
  provider VARCHAR(100),
  error_code VARCHAR(50),
  error_message TEXT NOT NULL,
  retryable BOOLEAN DEFAULT true,
  retried_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_configs_channel ON provider_configs(channel, is_active);
CREATE INDEX IF NOT EXISTS idx_campaign_errors_campaign ON campaign_errors(campaign_id, resolved);
CREATE INDEX IF NOT EXISTS idx_campaign_errors_retryable ON campaign_errors(retryable, resolved);

CREATE TABLE IF NOT EXISTS conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram')),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_value VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  lead_name VARCHAR(255),
  is_vip BOOLEAN DEFAULT false,
  assigned_to VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied')),
  unread_count INTEGER DEFAULT 0,
  last_message_preview TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel, contact_value)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES conversation_threads(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram')),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  provider_used VARCHAR(100),
  external_message_id VARCHAR(255),
  sender VARCHAR(255) NOT NULL,
  recipient VARCHAR(255),
  subject VARCHAR(500),
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'received', 'read')),
  error_message TEXT,
  assigned_to VARCHAR(255),
  retry_count INTEGER DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_threads_channel_status ON conversation_threads(channel, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_assigned ON conversation_threads(assigned_to, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_thread ON conversation_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_external ON conversation_messages(channel, external_message_id);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram')),
  contact_value VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  segment VARCHAR(20) NOT NULL DEFAULT 'cold' CHECK (segment IN ('hot', 'warm', 'cold')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_vip BOOLEAN NOT NULL DEFAULT false,
  assigned_to VARCHAR(255),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  last_contacted_at TIMESTAMPTZ,
  response_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel, contact_value)
);

CREATE INDEX IF NOT EXISTS idx_leads_channel_segment ON leads(channel, segment, is_vip);
CREATE INDEX IF NOT EXISTS idx_leads_contact ON leads(channel, contact_value);

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  channel VARCHAR(20) NOT NULL DEFAULT 'all',
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_data JSONB NOT NULL DEFAULT '{}',
  actions_executed JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_rule ON automation_logs(rule_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scheduled_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram')),
  campaign_config JSONB NOT NULL DEFAULT '{}',
  schedule_type VARCHAR(20) NOT NULL DEFAULT 'once' CHECK (schedule_type IN ('once', 'daily', 'weekly', 'monthly')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'paused', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_campaigns_next_run ON scheduled_campaigns(status, next_run_at);
`;

async function seedDefaultProviderConfigs() {
  const defaultProviders = [
    ...config.whatsapp.providers
      .filter((provider) => provider.phoneNumberId && provider.accessToken)
      .map((provider, index) => ({
        channel: 'whatsapp',
        name: provider.name,
        displayName: provider.name.replace(/_/g, ' '),
        priority: config.whatsapp.providers.length - index,
        costPerMsg: provider.costPerMsg,
        ratePerSec: config.whatsapp.ratePerSec,
        credentials: {
          phoneNumberId: provider.phoneNumberId,
          accessToken: provider.accessToken,
          apiVersion: config.whatsapp.apiVersion,
          verifyToken: config.whatsapp.verifyToken,
          webhookUrl: config.whatsapp.webhookUrl,
        },
      })),
    ...config.sms.providers.map((provider, index) => ({
      channel: 'sms',
      name: provider.name,
      displayName: provider.name.toUpperCase(),
      priority: config.sms.providers.length - index,
      costPerMsg: provider.costPerMsg,
      ratePerSec: config.sms.ratePerSec,
      credentials: {
        provider: provider.name,
        apiKey: 'apiKey' in provider ? provider.apiKey : undefined,
        authKey: 'authKey' in provider ? provider.authKey : undefined,
        senderId: 'senderId' in provider ? provider.senderId : undefined,
        sender: 'sender' in provider ? provider.sender : undefined,
        dltEntityId: config.sms.dltEntityId,
      },
    })).filter((provider) => Object.values(provider.credentials).some(Boolean)),
    ...config.email.providers.map((provider, index) => ({
      channel: 'email',
      name: provider.name,
      displayName: provider.name.toUpperCase(),
      priority: config.email.providers.length - index,
      costPerMsg: provider.costPerMsg,
      ratePerSec: config.email.ratePerSec,
      credentials: {
        provider: provider.name,
        apiKey: 'apiKey' in provider ? provider.apiKey : undefined,
        host: 'host' in provider ? provider.host : undefined,
        port: 'port' in provider ? provider.port : undefined,
        user: 'user' in provider ? provider.user : undefined,
        pass: 'pass' in provider ? provider.pass : undefined,
        fromEmail: config.email.from,
        secure: 'port' in provider ? provider.port === 465 : false,
      },
    })).filter((provider) => Object.values(provider.credentials).some(Boolean)),
  ];

  for (const provider of defaultProviders) {
    await pool.query(
      `INSERT INTO provider_configs
         (channel, name, display_name, priority, cost_per_msg, rate_per_sec, credentials, status, status_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'unchecked', 'Seeded from environment config')
       ON CONFLICT (channel, name) DO NOTHING`,
      [
        provider.channel,
        provider.name,
        provider.displayName,
        provider.priority,
        provider.costPerMsg,
        provider.ratePerSec,
        JSON.stringify(provider.credentials),
      ]
    );
  }
}

export async function migrate() {
  log.info('Running migrations...');
  await pool.query(schema);
  await seedDefaultProviderConfigs();
  log.info('Migrations complete');
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      log.error('Migration failed', err);
      process.exit(1);
    });
}
