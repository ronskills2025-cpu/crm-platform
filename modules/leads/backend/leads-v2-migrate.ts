import { pool } from '../../../packages/db/src/connection';
import { createLogger } from '../../../packages/utils/src/logger';

const log = createLogger('leads-v2-migrate');

export async function leadsMigrateV2(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Add tenant_id column with nil-UUID sentinel default ─────────────
    await client.query(`
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL
          DEFAULT '00000000-0000-0000-0000-000000000000'
    `);

    // ── 2. Add source (originating channel/form) ───────────────────────────
    await client.query(`
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS source VARCHAR(50)
    `);

    // ── 3. Add status (lead lifecycle) ─────────────────────────────────────
    await client.query(`
      ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'new'
    `);

    // Add CHECK constraint for status separately (safe if constraint exists)
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE leads
          ADD CONSTRAINT leads_status_check
          CHECK (status IN ('new','contacted','converted','lost'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // ── 4. Add phone / email as dedicated indexed columns ─────────────────
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);

    // ── 5. Expand channel CHECK to include telegram, messenger, instagram ──
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_channel_check;
        ALTER TABLE leads
          ADD CONSTRAINT leads_channel_check
          CHECK (channel IN ('whatsapp','sms','email','telegram','messenger','instagram'));
      EXCEPTION WHEN others THEN NULL;
      END $$
    `);

    // ── 6. Fix UNIQUE constraint — include tenant_id ───────────────────────
    // The old constraint (channel, contact_value) conflicts with multi-tenant design.
    // Replace it with a unique index on (tenant_id, channel, contact_value).
    await client.query(`
      ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_channel_contact_value_key
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_tenant_channel_contact
        ON leads(tenant_id, channel, contact_value)
    `);

    // ── 7. Performance indexes ─────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_tenant_status
        ON leads(tenant_id, status, created_at DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_tenant_source
        ON leads(tenant_id, source)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_phone
        ON leads(phone) WHERE phone IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_email
        ON leads(email) WHERE email IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_created_at
        ON leads(created_at DESC)
    `);

    // ── 8. campaign_leads mapping table ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_leads (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        tenant_id    UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
        status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','sent','delivered','opened','replied','failed')),
        sent_at      TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        opened_at    TIMESTAMPTZ,
        replied_at   TIMESTAMPTZ,
        error_msg    TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(campaign_id, lead_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead
        ON campaign_leads(lead_id, campaign_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_campaign_leads_status
        ON campaign_leads(campaign_id, status)
    `);

    // ── 9. Expand conversation_threads.channel + conversation_messages.channel ─
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE conversation_threads
          DROP CONSTRAINT IF EXISTS conversation_threads_channel_check;
        ALTER TABLE conversation_threads
          ADD CONSTRAINT conversation_threads_channel_check
          CHECK (channel IN ('whatsapp','sms','email','telegram','messenger','instagram'));
      EXCEPTION WHEN others THEN NULL;
      END $$
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE conversation_messages
          DROP CONSTRAINT IF EXISTS conversation_messages_channel_check;
        ALTER TABLE conversation_messages
          ADD CONSTRAINT conversation_messages_channel_check
          CHECK (channel IN ('whatsapp','sms','email','telegram','messenger','instagram'));
      EXCEPTION WHEN others THEN NULL;
      END $$
    `);

    await client.query('COMMIT');
    log.info('Leads v2 migration completed');
  } catch (err) {
    await client.query('ROLLBACK');
    log.error('Leads v2 migration failed', { error: String(err) });
    throw err;
  } finally {
    client.release();
  }
}
