import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('migrate:messenger');

const schema = `
-- Messenger messages table (Facebook Messenger / Meta Send API)
CREATE TABLE IF NOT EXISTS messenger_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_id VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  message_type VARCHAR(30) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'template', 'generic_template', 'button_template')),
  image_url TEXT,
  buttons JSONB,
  quick_replies JSONB,
  tag VARCHAR(50),
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'blocked')),
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

CREATE INDEX IF NOT EXISTS idx_messenger_campaign ON messenger_messages(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_messenger_recipient ON messenger_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messenger_sent_at ON messenger_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_messenger_status ON messenger_messages(status);
`;

const alterConstraints = `
DO $$
BEGIN
  -- provider_configs
  BEGIN ALTER TABLE provider_configs DROP CONSTRAINT IF EXISTS provider_configs_channel_check; EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE provider_configs ADD CONSTRAINT provider_configs_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger'));

  -- providers
  BEGIN ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_channel_check; EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE providers ADD CONSTRAINT providers_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger'));

  -- campaigns
  BEGIN ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_channel_check; EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE campaigns ADD CONSTRAINT campaigns_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger'));

  -- conversation_threads
  BEGIN ALTER TABLE conversation_threads DROP CONSTRAINT IF EXISTS conversation_threads_channel_check; EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE conversation_threads ADD CONSTRAINT conversation_threads_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger'));

  -- conversation_messages
  BEGIN ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_channel_check; EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger'));

  -- leads
  BEGIN ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_channel_check; EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE leads ADD CONSTRAINT leads_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger'));

  -- campaign_errors
  BEGIN ALTER TABLE campaign_errors DROP CONSTRAINT IF EXISTS campaign_errors_channel_check; EXCEPTION WHEN OTHERS THEN NULL; END;
  ALTER TABLE campaign_errors ADD CONSTRAINT campaign_errors_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram', 'messenger'));
END $$;
`;

export async function messengerMigrate() {
  try {
    await query(schema);
    log.info('Messenger messages table created/verified');
  } catch (err) {
    log.warn(`Messenger schema migration: ${(err as Error).message}`);
  }

  try {
    await query(alterConstraints);
    log.info('CHECK constraints updated to include messenger');
  } catch (err) {
    log.warn(`Messenger constraint migration: ${(err as Error).message}`);
  }
}
