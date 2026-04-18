import { query } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('migrate:billing');

const schema = `
-- Billing subscriptions table (existing)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  plan VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  amount INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment configurations for QR-based payments
CREATE TABLE IF NOT EXISTS payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  upi_id VARCHAR(255) NOT NULL,
  merchant_name VARCHAR(255) NOT NULL,
  qr_code_base64 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment requests for manual QR payments
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id VARCHAR(50) NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  amount INTEGER NOT NULL,
  user_details JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  transaction_id VARCHAR(255),
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_configs_tenant_id ON payment_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_tenant_id ON payment_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at);
`;

export async function migrateBilling(): Promise<void> {
  log.info('Running billing migrations...');
  
  try {
    await query(schema);
    log.info('✅ Billing migrations completed successfully');
  } catch (error) {
    log.error('❌ Billing migration failed:', error);
    throw error;
  }
}

// Auto-run if called directly
if (require.main === module) {
  migrateBilling()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
