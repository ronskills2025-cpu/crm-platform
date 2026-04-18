/**
 * scripts/seed.ts — Idempotent database seeder
 *
 * Seeds sample data for local development.
 * Safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING.
 *
 * Usage: npx tsx scripts/seed.ts
 */

import { connectDb, query, pool } from '../packages/db/src/connection';
import { connectRedis } from '../packages/db/src/redis';
import { createLogger } from '../packages/utils/src/logger';

const log = createLogger('seed');

// Fixed UUIDs for deterministic seeding
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID  = '00000000-0000-0000-0000-000000000002';

async function seed() {
  log.info('Connecting to database...');
  const dbOk = await connectDb();
  if (!dbOk) {
    log.error('Cannot connect to database. Ensure PostgreSQL is running.');
    process.exit(1);
  }

  await connectRedis();

  // ── Seed default tenant ───────────────────────────────────────
  log.info('Seeding default tenant...');
  await query(`
    INSERT INTO tenants (id, name, slug, plan, is_active, created_at)
    VALUES ($1, 'Default Tenant', 'default', 'pro', true, NOW())
    ON CONFLICT (id) DO NOTHING
  `, [TENANT_ID]);

  // ── Seed admin user ───────────────────────────────────────────
  log.info('Seeding admin user...');
  // Password: admin123 (bcrypt hash, cost 12)
  const adminHash = '$2a$12$OnfQClDCf3eQyHPH0djkx.PxSeuFBpocjDxCYhtL0o1mWqu7.nQnq';
  await query(`
    INSERT INTO users (id, tenant_id, email, password_hash, full_name, role, created_at)
    VALUES ($1, $2, 'admin@crm.local', $3, 'Admin User', 'admin', NOW())
    ON CONFLICT (email) DO NOTHING
  `, [ADMIN_ID, TENANT_ID, adminHash]);

  // ── Seed provider configs ─────────────────────────────────────
  log.info('Seeding provider configs...');
  const providers = [
    { channel: 'whatsapp', name: 'meta',         display: 'Meta (WhatsApp Cloud API)' },
    { channel: 'sms',      name: 'fast2sms',      display: 'Fast2SMS' },
    { channel: 'email',    name: 'resend',        display: 'Resend' },
    { channel: 'telegram', name: 'telegram_bot',  display: 'Telegram Bot' },
    { channel: 'messenger',name: 'fb_page',       display: 'Facebook Page' },
  ];

  for (const p of providers) {
    await query(`
      INSERT INTO provider_configs (channel, name, display_name, is_active, priority, credentials, extra_config, created_at)
      VALUES ($1, $2, $3, false, 1, '{}', '{}', NOW())
      ON CONFLICT DO NOTHING
    `, [p.channel, p.name, p.display]);
  }

  // ── Seed sample leads ─────────────────────────────────────────
  log.info('Seeding sample leads...');
  const leads = [
    { name: 'John Doe',    contact: '+919876543210', channel: 'whatsapp', segment: 'warm' },
    { name: 'Jane Smith',  contact: 'jane@example.com', channel: 'email', segment: 'hot' },
    { name: 'Raj Patel',   contact: '+919876543212', channel: 'sms',      segment: 'cold' },
    { name: 'Priya Kumar', contact: '+919876543213', channel: 'whatsapp', segment: 'warm' },
    { name: 'Alex Wilson', contact: '+919876543214', channel: 'telegram', segment: 'hot' },
  ];

  for (const l of leads) {
    await query(`
      INSERT INTO leads (tenant_id, channel, contact_value, name, segment, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT DO NOTHING
    `, [TENANT_ID, l.channel, l.contact, l.name, l.segment]);
  }

  // ── Seed sample campaign ──────────────────────────────────────
  log.info('Seeding sample campaign...');
  await query(`
    INSERT INTO campaigns (name, channel, status, message_body, total_contacts, created_at)
    VALUES ('Welcome Campaign', 'whatsapp', 'draft', 'Hello! Welcome to our platform.', 5, NOW())
    ON CONFLICT DO NOTHING
  `);

  log.info('Seed complete!');
  log.info('');
  log.info('Default login credentials:');
  log.info('  Email:    admin@crm.local');
  log.info('  Password: admin123');
  log.info('');

  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  log.error(`Seed failed | ${err.message}`);
  process.exit(1);
});

