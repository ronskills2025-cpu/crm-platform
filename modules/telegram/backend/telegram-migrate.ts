import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('telegram-migrate');

const schema = `
-- Telegram messages table
CREATE TABLE IF NOT EXISTS telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  chat_id VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  parse_mode VARCHAR(20),
  photo_url TEXT,
  reply_markup JSONB,
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'blocked')),
  provider_used VARCHAR(50),
  provider_msg_id VARCHAR(255),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  cost DECIMAL(10, 4) DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_campaign ON telegram_messages(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_telegram_chat_id ON telegram_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sent_at ON telegram_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_telegram_status ON telegram_messages(status);

-- Add 'telegram' to channel CHECK constraints (safe ALTER: only adds if missing)
DO $$
BEGIN
  -- Update provider_configs channel constraint to include telegram
  BEGIN
    ALTER TABLE provider_configs DROP CONSTRAINT IF EXISTS provider_configs_channel_check;
    ALTER TABLE provider_configs ADD CONSTRAINT provider_configs_channel_check
      CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'provider_configs constraint update skipped: %', SQLERRM;
  END;

  -- Update providers channel constraint
  BEGIN
    ALTER TABLE providers DROP CONSTRAINT IF EXISTS providers_channel_check;
    ALTER TABLE providers ADD CONSTRAINT providers_channel_check
      CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'providers constraint update skipped: %', SQLERRM;
  END;

  -- Update campaigns channel constraint
  BEGIN
    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_channel_check;
    ALTER TABLE campaigns ADD CONSTRAINT campaigns_channel_check
      CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'campaigns constraint update skipped: %', SQLERRM;
  END;

  -- Update conversation_threads channel constraint
  BEGIN
    ALTER TABLE conversation_threads DROP CONSTRAINT IF EXISTS conversation_threads_channel_check;
    ALTER TABLE conversation_threads ADD CONSTRAINT conversation_threads_channel_check
      CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'conversation_threads constraint update skipped: %', SQLERRM;
  END;

  -- Update conversation_messages channel constraint
  BEGIN
    ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_channel_check;
    ALTER TABLE conversation_messages ADD CONSTRAINT conversation_messages_channel_check
      CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'conversation_messages constraint update skipped: %', SQLERRM;
  END;

  -- Update leads channel constraint
  BEGIN
    ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_channel_check;
    ALTER TABLE leads ADD CONSTRAINT leads_channel_check
      CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'leads constraint update skipped: %', SQLERRM;
  END;

  -- Update campaign_errors channel constraint
  BEGIN
    ALTER TABLE campaign_errors DROP CONSTRAINT IF EXISTS campaign_errors_channel_check;
    ALTER TABLE campaign_errors ADD CONSTRAINT campaign_errors_channel_check
      CHECK (channel IN ('whatsapp', 'sms', 'email', 'telegram'));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'campaign_errors constraint update skipped: %', SQLERRM;
  END;
END
$$;
`;

export async function telegramMigrate() {
  try {
    await pool.query(schema);
    log.info('Telegram migration completed');
  } catch (err) {
    log.error('Telegram migration failed', err);
    throw err;
  }
}
