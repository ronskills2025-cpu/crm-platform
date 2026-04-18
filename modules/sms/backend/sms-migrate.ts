import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('sms-migrate');

const schema = `
-- ── DLT Entities ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_dlt_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  entity_id VARCHAR(100) NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  region VARCHAR(10) NOT NULL DEFAULT 'IN',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, entity_id)
);

-- ── DLT Templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_dlt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  dlt_entity_id UUID REFERENCES sms_dlt_entities(id) ON DELETE CASCADE,
  template_id VARCHAR(100) NOT NULL,
  template_name VARCHAR(255),
  content_template TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  category VARCHAR(50) DEFAULT 'transactional',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, template_id)
);

-- ── Sender IDs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_sender_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  sender_id VARCHAR(20) NOT NULL,
  display_name VARCHAR(100),
  sender_type VARCHAR(20) DEFAULT 'alphanumeric' CHECK (sender_type IN ('alphanumeric', 'numeric', 'shortcode')),
  region VARCHAR(10),
  provider_name VARCHAR(100),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Virtual Numbers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_virtual_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  provider_name VARCHAR(100) NOT NULL,
  region VARCHAR(10) NOT NULL,
  capabilities TEXT[] DEFAULT '{sms}',
  monthly_cost DECIMAL(10,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Region Routing Rules ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_region_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  region VARCHAR(10) NOT NULL,
  provider_chain TEXT[] NOT NULL DEFAULT '{}',
  requires_dlt BOOLEAN DEFAULT false,
  default_sender_id VARCHAR(20),
  default_entity_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, region)
);

-- ── SMS Analytics (materialized per-hour for fast dashboards) ─────
CREATE TABLE IF NOT EXISTS sms_analytics_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  provider_name VARCHAR(100),
  region VARCHAR(10),
  hour_bucket TIMESTAMPTZ NOT NULL,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  total_cost DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, campaign_id, provider_name, region, hour_bucket)
);

-- ── Scheduled Campaigns (SMS-specific schedule support) ───────────
-- Reuses existing campaigns table with scheduled_at field.
-- This table tracks the cron/one-shot schedule metadata.
CREATE TABLE IF NOT EXISTS sms_scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  schedule_type VARCHAR(20) DEFAULT 'once' CHECK (schedule_type IN ('once', 'recurring')),
  cron_expression VARCHAR(100),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sms_dlt_entities_tenant ON sms_dlt_entities(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sms_dlt_templates_tenant ON sms_dlt_templates(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sms_dlt_templates_entity ON sms_dlt_templates(dlt_entity_id);
CREATE INDEX IF NOT EXISTS idx_sms_sender_ids_tenant ON sms_sender_ids(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sms_virtual_numbers_region ON sms_virtual_numbers(region, is_active);
CREATE INDEX IF NOT EXISTS idx_sms_region_routes_tenant ON sms_region_routes(tenant_id, region);
CREATE INDEX IF NOT EXISTS idx_sms_analytics_hour ON sms_analytics_hourly(hour_bucket, tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_analytics_campaign ON sms_analytics_hourly(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_scheduled_next ON sms_scheduled_jobs(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sms_messages_region ON sms_messages(region);
CREATE INDEX IF NOT EXISTS idx_sms_messages_provider ON sms_messages(provider_used, status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_delivered ON sms_messages(delivered_at) WHERE delivered_at IS NOT NULL;

-- Add tenant_id to sms_messages if not present
DO $$ BEGIN
  ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS tenant_id UUID;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sms_messages_tenant ON sms_messages(tenant_id) WHERE tenant_id IS NOT NULL;
`;

export async function smsMigrate(): Promise<void> {
  try {
    await pool.query(schema);
    log.info('SMS module migration completed');
  } catch (err) {
    log.warn(`SMS migration partially failed: ${(err as Error).message}`);
  }
}
