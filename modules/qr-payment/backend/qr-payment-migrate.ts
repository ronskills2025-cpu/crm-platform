import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('qr-payment-migrate');

export async function qrPaymentMigrate(): Promise<void> {
  log.info('Running QR Payment migration…');

  // ── Payment Configuration (per tenant) ──────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS qr_payment_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL UNIQUE,
      qr_code_url TEXT,
      upi_id VARCHAR(100),
      bank_details JSONB DEFAULT '{}',
      whatsapp_number VARCHAR(20),
      instructions TEXT,
      is_enabled BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Payments ────────────────────────────────────────────────────────────
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qr_payment_status') THEN
        CREATE TYPE qr_payment_status AS ENUM ('pending', 'approved', 'rejected');
      END IF;
    END $$
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS qr_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      transaction_id VARCHAR(100) NOT NULL,
      name VARCHAR(200) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      email VARCHAR(200),
      amount NUMERIC(12,2) NOT NULL,
      screenshot_path TEXT NOT NULL,
      screenshot_hash VARCHAR(64),
      status qr_payment_status DEFAULT 'pending',
      admin_notes TEXT,
      reviewed_by UUID,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, transaction_id)
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_qr_payments_tenant ON qr_payments(tenant_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_qr_payments_status ON qr_payments(tenant_id, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_qr_payments_phone ON qr_payments(tenant_id, phone)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_qr_payments_hash ON qr_payments(screenshot_hash) WHERE screenshot_hash IS NOT NULL`);

  // ── Audit Logs ──────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS qr_payment_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      payment_id UUID NOT NULL REFERENCES qr_payments(id) ON DELETE CASCADE,
      action VARCHAR(40) NOT NULL,
      performed_by UUID NOT NULL,
      old_status VARCHAR(20),
      new_status VARCHAR(20),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_qr_audit_payment ON qr_payment_audit_logs(payment_id)`);

  log.info('QR Payment migration complete');
}
