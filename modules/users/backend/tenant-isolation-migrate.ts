/**
 * Tenant Isolation Migration
 * Adds tenant_id to all core tables that were missing multi-tenant isolation.
 * This ensures complete data isolation between tenants.
 */
import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('tenant-isolation-migrate');

const migrationSql = `
-- ══════════════════════════════════════════════════════════════════════
-- Add tenant_id to core tables for multi-tenant isolation
-- ══════════════════════════════════════════════════════════════════════

-- ── campaigns ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
  END IF;
END $$;

-- ── leads ────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_leads_tenant ON leads(tenant_id);
    -- Update unique constraint to be tenant-scoped
    ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_channel_contact_value_key;
    ALTER TABLE leads ADD CONSTRAINT leads_tenant_channel_contact UNIQUE (tenant_id, channel, contact_value);
  END IF;
END $$;

-- ── whatsapp_messages ────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_whatsapp_messages_tenant ON whatsapp_messages(tenant_id);
  END IF;
END $$;

-- ── sms_messages ─────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE sms_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_sms_messages_tenant ON sms_messages(tenant_id);
  END IF;
END $$;

-- ── email_messages ───────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE email_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_email_messages_tenant ON email_messages(tenant_id);
  END IF;
END $$;

-- ── telegram_messages ────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'telegram_messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE telegram_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_telegram_messages_tenant ON telegram_messages(tenant_id);
  END IF;
END $$;

-- ── messenger_messages ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messenger_messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE messenger_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_messenger_messages_tenant ON messenger_messages(tenant_id);
  END IF;
END $$;

-- ── conversation_threads ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_threads' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE conversation_threads ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_conversation_threads_tenant ON conversation_threads(tenant_id);
    -- Update unique constraint to be tenant-scoped
    ALTER TABLE conversation_threads DROP CONSTRAINT IF EXISTS conversation_threads_channel_contact_value_key;
    ALTER TABLE conversation_threads ADD CONSTRAINT conv_threads_tenant_channel_contact UNIQUE (tenant_id, channel, contact_value);
  END IF;
END $$;

-- ── conversation_messages ────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE conversation_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_conversation_messages_tenant ON conversation_messages(tenant_id);
  END IF;
END $$;

-- ── automation_rules ─────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_rules' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE automation_rules ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_automation_rules_tenant ON automation_rules(tenant_id);
  END IF;
END $$;

-- ── automation_logs ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_logs' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE automation_logs ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_automation_logs_tenant ON automation_logs(tenant_id);
  END IF;
END $$;

-- ── scheduled_campaigns ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scheduled_campaigns' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE scheduled_campaigns ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_scheduled_campaigns_tenant ON scheduled_campaigns(tenant_id);
  END IF;
END $$;

-- ── failed_messages ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'failed_messages' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE failed_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_failed_messages_tenant ON failed_messages(tenant_id);
  END IF;
END $$;

-- ── campaign_errors ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_errors' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE campaign_errors ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    CREATE INDEX idx_campaign_errors_tenant ON campaign_errors(tenant_id);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- Performance indexes for high-scale queries
-- ══════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status_sent ON whatsapp_messages(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status_sent ON sms_messages(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_status_sent ON email_messages(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_status_sent ON telegram_messages(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messenger_messages_status_sent ON messenger_messages(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_segment ON leads(tenant_id, segment, is_vip);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conv_threads_tenant_status ON conversation_threads(tenant_id, status, last_message_at DESC);
`;

export async function tenantIsolationMigrate(): Promise<void> {
  try {
    await pool.query(migrationSql);
    log.info('Tenant isolation migration completed');
  } catch (err) {
    log.warn(`Tenant isolation migration failed: ${(err as Error).message}`);
    throw err;
  }
}
