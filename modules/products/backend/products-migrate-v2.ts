/**
 * Products migration v2 — adds tables for 4 new WhatsApp Automation Products:
 *   6. Event Reminder System
 *   7. Catalog + Order Bot
 *   8. Feedback Survey Bot
 *   9. Membership Renewal Bot
 *
 * Called automatically on startup (after productsMigrate).
 */
import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('products-migrate-v2');

const productsV2Sql = `

-- ── Extend product_type CHECK constraint ─────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE automation_products DROP CONSTRAINT IF EXISTS automation_products_product_type_check;
  ALTER TABLE automation_products ADD CONSTRAINT automation_products_product_type_check
    CHECK (product_type IN ('funnel','cart_recovery','appointment','payment','review',
                            'event','catalog','survey','membership'));
END $$;

-- ── Events (Product 6: Event Reminder System) ───────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  event_date     DATE NOT NULL,
  event_time     TIME,
  location       VARCHAR(500),
  event_url      TEXT,
  recording_url  TEXT,
  certificate_url TEXT,
  max_attendees  INTEGER,
  status         VARCHAR(20) NOT NULL DEFAULT 'upcoming'
                   CHECK (status IN ('draft','upcoming','live','completed','cancelled')),
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name     VARCHAR(255),
  customer_phone    VARCHAR(30) NOT NULL,
  customer_email    VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'registered'
                      CHECK (status IN ('registered','confirmed','attended','missed','cancelled')),
  confirmation_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_24h_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_1h_sent  BOOLEAN NOT NULL DEFAULT false,
  post_event_sent   BOOLEAN NOT NULL DEFAULT false,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Catalog Products (Product 7: Catalog + Order Bot) ────────────────────────
CREATE TABLE IF NOT EXISTS catalog_products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  price          DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency       VARCHAR(10) DEFAULT 'INR',
  image_url      TEXT,
  sku            VARCHAR(100),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  customer_name   VARCHAR(255),
  customer_phone  VARCHAR(30) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','paid','shipped','delivered','cancelled')),
  total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10) DEFAULT 'INR',
  payment_link    TEXT,
  payment_status  VARCHAR(20) DEFAULT 'none'
                    CHECK (payment_status IN ('none','pending','paid','failed','refunded')),
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES catalog_orders(id) ON DELETE CASCADE,
  catalog_product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  quantity           INTEGER NOT NULL DEFAULT 1,
  unit_price         DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal           DECIMAL(12,2) NOT NULL DEFAULT 0
);

-- ── Surveys (Product 8: Feedback Survey Bot) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS surveys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','closed')),
  response_count INTEGER NOT NULL DEFAULT 0,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  question_order  INTEGER NOT NULL DEFAULT 0,
  question_type   VARCHAR(30) NOT NULL DEFAULT 'text'
                    CHECK (question_type IN ('rating','text','multiple_choice','yes_no')),
  question_text   TEXT NOT NULL,
  options         JSONB NOT NULL DEFAULT '[]',
  is_required     BOOLEAN NOT NULL DEFAULT true,
  condition       JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(survey_id, question_order)
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  customer_name   VARCHAR(255),
  customer_phone  VARCHAR(30) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','partial','completed')),
  answers         JSONB NOT NULL DEFAULT '{}',
  sentiment       VARCHAR(20),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Memberships (Product 9: Membership Renewal Bot) ──────────────────────────
CREATE TABLE IF NOT EXISTS memberships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id        UUID REFERENCES automation_products(id) ON DELETE CASCADE,
  customer_name     VARCHAR(255),
  customer_phone    VARCHAR(30) NOT NULL,
  customer_email    VARCHAR(255),
  tier              VARCHAR(50) NOT NULL DEFAULT 'standard',
  start_date        DATE NOT NULL,
  expiry_date       DATE NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','expiring','expired','renewed','cancelled')),
  auto_renew        BOOLEAN NOT NULL DEFAULT false,
  payment_link      TEXT,
  payment_status    VARCHAR(20) DEFAULT 'none'
                      CHECK (payment_status IN ('none','pending','paid','failed')),
  amount            DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency          VARCHAR(10) DEFAULT 'INR',
  renewal_count     INTEGER NOT NULL DEFAULT 0,
  reminder_7d_sent  BOOLEAN NOT NULL DEFAULT false,
  reminder_1d_sent  BOOLEAN NOT NULL DEFAULT false,
  reminder_expiry_sent BOOLEAN NOT NULL DEFAULT false,
  late_fee          DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes             TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes (v2) ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_tenant              ON events(tenant_id, status, event_date);
CREATE INDEX IF NOT EXISTS idx_events_product             ON events(product_id, status);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event  ON event_registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_registrations_tenant ON event_registrations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_registrations_phone  ON event_registrations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_catalog_products_tenant    ON catalog_products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_catalog_products_product   ON catalog_products(product_id);
CREATE INDEX IF NOT EXISTS idx_catalog_orders_tenant      ON catalog_orders(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_orders_product     ON catalog_orders(product_id, status);
CREATE INDEX IF NOT EXISTS idx_catalog_order_items_order  ON catalog_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_surveys_tenant             ON surveys(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_surveys_product            ON surveys(product_id, status);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey    ON survey_questions(survey_id, question_order);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey    ON survey_responses(survey_id, status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_tenant    ON survey_responses(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant         ON memberships(tenant_id, status, expiry_date);
CREATE INDEX IF NOT EXISTS idx_memberships_product        ON memberships(product_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_expiry         ON memberships(expiry_date, status);
`;

export async function productsMigrateV2(): Promise<void> {
  try {
    await pool.query(productsV2Sql);
    log.info('Products v2 schema migration complete');
  } catch (err) {
    log.error('Products v2 migration failed', err);
    throw err;
  }
}
