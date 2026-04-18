/**
 * Products migration — adds tables for the WhatsApp Automation Products Suite.
 * Called automatically on startup (after saas-migrate).
 *
 * Products:
 *   1. Funnel-in-a-Box
 *   2. Cart Recovery (extended)
 *   3. Appointment Booking Bot
 *   4. Payment Collection Bot
 *   5. Review Collector
 */
import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('products-migrate');

const productsSql = `

-- ── Automation Products registry ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_type VARCHAR(50) NOT NULL
                 CHECK (product_type IN ('funnel','cart_recovery','appointment','payment','review')),
  name         VARCHAR(255) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, product_type)
);

-- ── Product configs (key-value per product) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS product_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES automation_products(id) ON DELETE CASCADE,
  config_key  VARCHAR(100) NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, config_key)
);

-- ── Funnel Leads (Product 1: Funnel-in-a-Box) ───────────────────────────────
CREATE TABLE IF NOT EXISTS funnel_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  name          VARCHAR(255),
  phone         VARCHAR(30) NOT NULL,
  email         VARCHAR(255),
  interest      VARCHAR(255),
  source        VARCHAR(50) NOT NULL DEFAULT 'meta_ads',
  status        VARCHAR(30) NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','contacted','hot','converted','lost')),
  score         INTEGER NOT NULL DEFAULT 0,
  assigned_to   VARCHAR(255),
  payment_link  TEXT,
  payment_status VARCHAR(20) DEFAULT 'none'
                   CHECK (payment_status IN ('none','pending','paid','failed')),
  payment_amount DECIMAL(12,2) DEFAULT 0,
  click_count    INTEGER NOT NULL DEFAULT 0,
  reply_count    INTEGER NOT NULL DEFAULT 0,
  current_step   INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  last_contacted_at TIMESTAMPTZ,
  converted_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Funnel Steps (multi-step automation for Product 1) ───────────────────────
CREATE TABLE IF NOT EXISTS funnel_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES automation_products(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  action_type VARCHAR(30) NOT NULL DEFAULT 'send_message'
                CHECK (action_type IN ('send_message','send_payment_link','send_document','assign_operator','update_status')),
  message_template TEXT,
  document_url TEXT,
  config       JSONB NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, step_number)
);

-- ── Funnel Step Executions log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnel_step_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES funnel_leads(id) ON DELETE CASCADE,
  step_id     UUID NOT NULL REFERENCES funnel_steps(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','sent','failed','skipped')),
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Booking Services (Product 3: Appointment Bot) ────────────────────────────
CREATE TABLE IF NOT EXISTS booking_services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  duration_min INTEGER NOT NULL DEFAULT 30,
  price        DECIMAL(12,2) DEFAULT 0,
  currency     VARCHAR(10) DEFAULT 'INR',
  location     VARCHAR(255),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Booking Slots (available time windows) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_slots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id   UUID NOT NULL REFERENCES booking_services(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  max_bookings INTEGER NOT NULL DEFAULT 1,
  is_active    BOOLEAN NOT NULL DEFAULT true
);

-- ── Bookings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  service_id     UUID REFERENCES booking_services(id) ON DELETE SET NULL,
  customer_name  VARCHAR(255),
  customer_phone VARCHAR(30) NOT NULL,
  customer_email VARCHAR(255),
  booking_date   DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                   CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  payment_status VARCHAR(20) DEFAULT 'none'
                   CHECK (payment_status IN ('none','pending','paid','refunded')),
  payment_amount DECIMAL(12,2) DEFAULT 0,
  payment_link   TEXT,
  reminder_sent  BOOLEAN NOT NULL DEFAULT false,
  notes          TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Payment Collections (Product 4: Payment Bot) ─────────────────────────────
CREATE TABLE IF NOT EXISTS payment_collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  customer_name   VARCHAR(255),
  customer_phone  VARCHAR(30) NOT NULL,
  customer_email  VARCHAR(255),
  customer_group  VARCHAR(100),
  amount_due      DECIMAL(12,2) NOT NULL,
  amount_paid     DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10) DEFAULT 'INR',
  due_date        DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','partial','paid','overdue','escalated')),
  payment_link    TEXT,
  reminder_count  INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  escalated_at    TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  receipt_sent    BOOLEAN NOT NULL DEFAULT false,
  late_fee        DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reviews (Product 5: Review Collector) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  customer_name   VARCHAR(255),
  customer_phone  VARCHAR(30) NOT NULL,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback        TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','rated','redirected','escalated','no_response')),
  google_review_url TEXT,
  redirect_sent   BOOLEAN NOT NULL DEFAULT false,
  followup_count  INTEGER NOT NULL DEFAULT 0,
  last_followup_at TIMESTAMPTZ,
  rated_at        TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Product Events (unified activity log) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  product_type VARCHAR(50) NOT NULL,
  event_type   VARCHAR(100) NOT NULL,
  entity_id    UUID,
  entity_type  VARCHAR(50),
  data         JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Product Notifications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_type VARCHAR(50) NOT NULL,
  event_type   VARCHAR(50) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  message      TEXT NOT NULL,
  entity_id    UUID,
  is_read      BOOLEAN NOT NULL DEFAULT false,
  priority     VARCHAR(10) NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('low','normal','high','urgent')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_automation_products_tenant ON automation_products(tenant_id, product_type);
CREATE INDEX IF NOT EXISTS idx_product_configs_product    ON product_configs(product_id);
CREATE INDEX IF NOT EXISTS idx_funnel_leads_tenant        ON funnel_leads(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_leads_phone         ON funnel_leads(phone);
CREATE INDEX IF NOT EXISTS idx_funnel_leads_product       ON funnel_leads(product_id, status);
CREATE INDEX IF NOT EXISTS idx_funnel_steps_product       ON funnel_steps(product_id, step_number);
CREATE INDEX IF NOT EXISTS idx_funnel_step_logs_lead      ON funnel_step_logs(lead_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_services_tenant    ON booking_services(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_booking_slots_service      ON booking_slots(service_id, day_of_week, is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant            ON bookings(tenant_id, booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status            ON bookings(status, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_product           ON bookings(product_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_collections_tenant ON payment_collections(tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_payment_collections_product ON payment_collections(product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_tenant             ON reviews(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_product            ON reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_product_events_tenant      ON product_events(tenant_id, product_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_entity      ON product_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_product_notifications_tenant ON product_notifications(tenant_id, is_read, created_at DESC);
`;

export async function productsMigrate(): Promise<void> {
  try {
    await pool.query(productsSql);
    log.info('Products schema migration complete');
  } catch (err) {
    log.error('Products migration failed', err);
    throw err;
  }
}
