/**
 * Meta Compliance Database Migration
 * Creates tables for opt-in tracking, message auditing, and compliance reporting
 */

import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('compliance-migrate');

const complianceSql = `
-- ═══════════════════════════════════════════════════════════════
-- OPT-IN RECORDS (CRITICAL FOR META COMPLIANCE)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS opt_in_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number      VARCHAR(20) NOT NULL,
  opt_in_method     VARCHAR(20) NOT NULL CHECK (opt_in_method IN ('website', 'qr_code', 'keyword', 'manual', 'api')),
  opt_in_source     VARCHAR(255) NOT NULL, -- URL, QR code ID, keyword, etc.
  consent_text      TEXT NOT NULL, -- Exact consent text shown to user
  ip_address        INET,
  user_agent        TEXT,
  opted_in_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opted_out_at      TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_opt_in_tenant_phone ON opt_in_records(tenant_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_opt_in_active ON opt_in_records(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_opt_in_date ON opt_in_records(opted_in_at);

-- ═══════════════════════════════════════════════════════════════
-- MESSAGE AUDIT LOGS (COMPLIANCE TRACKING)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS message_audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number      VARCHAR(20) NOT NULL,
  message_type      VARCHAR(20) NOT NULL CHECK (message_type IN ('template', 'text', 'media')),
  message_content   TEXT NOT NULL,
  opt_in_verified   BOOLEAN NOT NULL DEFAULT false,
  compliance_status VARCHAR(20) NOT NULL CHECK (compliance_status IN ('approved', 'rejected', 'flagged')),
  rejection_reason  TEXT,
  whatsapp_message_id VARCHAR(255), -- WhatsApp API message ID
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance and reporting
CREATE INDEX IF NOT EXISTS idx_audit_tenant_phone ON message_audit_logs(tenant_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_audit_status ON message_audit_logs(tenant_id, compliance_status);
CREATE INDEX IF NOT EXISTS idx_audit_date ON message_audit_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_audit_wa_msg_id ON message_audit_logs(whatsapp_message_id);

-- ═══════════════════════════════════════════════════════════════
-- COMPLIANCE VIOLATIONS (TRACKING ISSUES)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS compliance_violations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number      VARCHAR(20) NOT NULL,
  violation_type    VARCHAR(50) NOT NULL, -- 'no_opt_in', 'spam_content', 'rate_limit', etc.
  violation_details TEXT NOT NULL,
  message_content   TEXT,
  severity          VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved          BOOLEAN NOT NULL DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_violations_tenant ON compliance_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_violations_unresolved ON compliance_violations(tenant_id, resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_violations_severity ON compliance_violations(tenant_id, severity);

-- ═══════════════════════════════════════════════════════════════
-- UNSUBSCRIBE REQUESTS (OPT-OUT TRACKING)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS unsubscribe_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number      VARCHAR(20) NOT NULL,
  unsubscribe_method VARCHAR(20) NOT NULL CHECK (unsubscribe_method IN ('keyword', 'link', 'manual', 'api')),
  unsubscribe_source VARCHAR(255), -- Message ID, link ID, etc.
  ip_address        INET,
  user_agent        TEXT,
  processed         BOOLEAN NOT NULL DEFAULT false,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tenant_phone ON unsubscribe_requests(tenant_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_processed ON unsubscribe_requests(tenant_id, processed);

-- ═══════════════════════════════════════════════════════════════
-- CONSENT PREFERENCES (GRANULAR CONSENT MANAGEMENT)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS consent_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number      VARCHAR(20) NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  service_consent   BOOLEAN NOT NULL DEFAULT false,
  promotional_consent BOOLEAN NOT NULL DEFAULT false,
  data_processing_consent BOOLEAN NOT NULL DEFAULT false,
  consent_version   VARCHAR(10) NOT NULL DEFAULT '1.0', -- Track consent version changes
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint and indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_tenant_phone ON consent_preferences(tenant_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_consent_marketing ON consent_preferences(tenant_id, marketing_consent);

-- ═══════════════════════════════════════════════════════════════
-- COMPLIANCE SETTINGS (PER TENANT)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS compliance_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  require_double_opt_in BOOLEAN NOT NULL DEFAULT false,
  auto_opt_out_keywords TEXT[] DEFAULT ARRAY['STOP', 'UNSUBSCRIBE', 'OPT OUT'],
  max_messages_per_hour INTEGER NOT NULL DEFAULT 10,
  max_messages_per_day INTEGER NOT NULL DEFAULT 100,
  content_filtering_enabled BOOLEAN NOT NULL DEFAULT true,
  spam_detection_enabled BOOLEAN NOT NULL DEFAULT true,
  compliance_webhook_url VARCHAR(500), -- Notify external systems of violations
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS AND TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Function to automatically process opt-out keywords
CREATE OR REPLACE FUNCTION process_opt_out_keywords()
RETURNS TRIGGER AS $$
DECLARE
  settings_record compliance_settings%ROWTYPE;
  keyword TEXT;
BEGIN
  -- Get compliance settings for tenant
  SELECT * INTO settings_record 
  FROM compliance_settings 
  WHERE tenant_id = NEW.tenant_id;
  
  -- Check if message contains opt-out keywords
  IF settings_record.auto_opt_out_keywords IS NOT NULL THEN
    FOREACH keyword IN ARRAY settings_record.auto_opt_out_keywords
    LOOP
      IF UPPER(NEW.message_content) LIKE '%' || UPPER(keyword) || '%' THEN
        -- Record unsubscribe request
        INSERT INTO unsubscribe_requests (tenant_id, phone_number, unsubscribe_method, unsubscribe_source)
        VALUES (NEW.tenant_id, NEW.phone_number, 'keyword', keyword);
        
        -- Update opt-in record
        UPDATE opt_in_records 
        SET opted_out_at = NOW(), is_active = false, updated_at = NOW()
        WHERE tenant_id = NEW.tenant_id AND phone_number = NEW.phone_number AND is_active = true;
        
        EXIT; -- Exit loop after first match
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process opt-out keywords on incoming messages
-- Note: This would be triggered by your webhook handler
-- CREATE TRIGGER trigger_process_opt_out_keywords
--   AFTER INSERT ON incoming_messages
--   FOR EACH ROW EXECUTE FUNCTION process_opt_out_keywords();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_opt_in_updated_at
  BEFORE UPDATE ON opt_in_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_compliance_settings_updated_at
  BEFORE UPDATE ON compliance_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- DEFAULT COMPLIANCE SETTINGS FOR EXISTING TENANTS
-- ═══════════════════════════════════════════════════════════════
INSERT INTO compliance_settings (tenant_id)
SELECT id FROM tenants 
WHERE id NOT IN (SELECT tenant_id FROM compliance_settings)
ON CONFLICT (tenant_id) DO NOTHING;
`;

export async function runComplianceMigration() {
  try {
    log.info('Starting compliance migration...');
    
    await pool.query(complianceSql);
    
    log.info('✅ Compliance migration completed successfully');
    log.info('Created tables: opt_in_records, message_audit_logs, compliance_violations, unsubscribe_requests, consent_preferences, compliance_settings');
    
  } catch (error) {
    log.error('❌ Compliance migration failed:', error);
    throw error;
  }
}

// Auto-run migration if called directly
if (require.main === module) {
  runComplianceMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
