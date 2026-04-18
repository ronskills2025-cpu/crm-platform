/**
 * Bot Manager Database Migration
 * 
 * Creates tables for the centralized bot management system.
 */

import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('bot-migrate');

const schema = `
-- ══════════════════════════════════════════════════════════════════════════
-- BOT DEFINITIONS
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram', 'all')),
  bot_type VARCHAR(50) NOT NULL CHECK (bot_type IN ('auto_reply', 'faq', 'lead_capture', 'appointment', 'survey', 'payment', 'custom')),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  welcome_message TEXT,
  fallback_message TEXT DEFAULT 'Sorry, I didn''t understand that. Please try again or type "help" for assistance.',
  human_handoff_enabled BOOLEAN DEFAULT true,
  human_handoff_keywords TEXT[] DEFAULT ARRAY['human', 'agent', 'support', 'help'],
  business_hours JSONB DEFAULT '{"enabled": false}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bots_tenant ON bots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bots_channel ON bots(channel);
CREATE INDEX IF NOT EXISTS idx_bots_active ON bots(is_active) WHERE is_active = true;

-- ══════════════════════════════════════════════════════════════════════════
-- BOT TRIGGERS (When to activate the bot)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bot_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
    'message_received', 'keyword_match', 'new_lead', 'lead_updated',
    'campaign_event', 'webhook', 'schedule', 'no_reply', 'first_message'
  )),
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_triggers_bot ON bot_triggers(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_triggers_type ON bot_triggers(trigger_type);

-- ══════════════════════════════════════════════════════════════════════════
-- BOT RULES (Conditions to evaluate)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bot_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_order INTEGER DEFAULT 0,
  conditions JSONB NOT NULL DEFAULT '[]',
  match_type VARCHAR(10) DEFAULT 'all' CHECK (match_type IN ('all', 'any')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_rules_bot ON bot_rules(bot_id);

-- ══════════════════════════════════════════════════════════════════════════
-- BOT ACTIONS (What to do when rules match)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bot_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES bot_rules(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'send_message', 'send_template', 'send_media', 'ask_question',
    'create_lead', 'update_lead', 'tag_lead', 'assign_agent',
    'create_appointment', 'send_survey', 'send_payment_link',
    'trigger_webhook', 'delay', 'human_handoff', 'end_conversation',
    'set_variable', 'conditional_branch'
  )),
  action_config JSONB NOT NULL DEFAULT '{}',
  action_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_actions_rule ON bot_actions(rule_id);

-- ══════════════════════════════════════════════════════════════════════════
-- BOT CONVERSATIONS (Active bot sessions)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  contact_value VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  lead_id UUID,
  thread_id UUID,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'handed_off')),
  current_step VARCHAR(100),
  context JSONB DEFAULT '{}',
  variables JSONB DEFAULT '{}',
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  handed_off_at TIMESTAMPTZ,
  handed_off_to UUID,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_conv_bot ON bot_conversations(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_conv_contact ON bot_conversations(channel, contact_value);
CREATE INDEX IF NOT EXISTS idx_bot_conv_status ON bot_conversations(status) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_conv_active ON bot_conversations(bot_id, channel, contact_value) WHERE status = 'active';

-- ══════════════════════════════════════════════════════════════════════════
-- BOT MESSAGES (Message history within bot conversations)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES bot_conversations(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'template', 'media', 'button', 'list', 'quick_reply')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  rule_id UUID,
  action_id UUID,
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_messages_conv ON bot_messages(conversation_id);

-- ══════════════════════════════════════════════════════════════════════════
-- BOT EXECUTION LOGS (Audit trail)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bot_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES bot_conversations(id) ON DELETE SET NULL,
  trigger_id UUID,
  rule_id UUID,
  action_id UUID,
  event_type VARCHAR(50) NOT NULL,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_logs_bot ON bot_execution_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_logs_conv ON bot_execution_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bot_logs_created ON bot_execution_logs(created_at);

-- ══════════════════════════════════════════════════════════════════════════
-- BOT TEMPLATES (Reusable message templates)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bot_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_templates_tenant ON bot_templates(tenant_id);

-- ══════════════════════════════════════════════════════════════════════════
-- BOT FAQ (Knowledge base for FAQ bots)
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bot_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  answer TEXT NOT NULL,
  category VARCHAR(100),
  priority INTEGER DEFAULT 0,
  hit_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_faq_bot ON bot_faq(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_faq_keywords ON bot_faq USING GIN(keywords);
`;

export async function runBotMigration(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    log.info('Bot Manager migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    log.error('Bot Manager migration failed', err);
    throw err;
  } finally {
    client.release();
  }
}

export default runBotMigration;
