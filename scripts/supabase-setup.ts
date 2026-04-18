/**
 * Supabase Setup Script
 * 
 * This script helps configure and validate the Supabase connection.
 * It runs all existing migrations against Supabase.
 * 
 * Usage: npx tsx scripts/supabase-setup.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { pool, connectDb } from '../packages/db/src/connection';
import { getSupabaseStatus } from '../packages/db/src/supabase';
import { migrate } from '../packages/db/src/migrate';
import { saasMigrate, waSaasMigrate } from '../modules/wa-saas/backend/saas-migrate';
import { productsMigrate } from '../modules/products/backend/products-migrate';
import { productsMigrateV2 } from '../modules/products/backend/products-migrate-v2';
import { instagramMigrate } from '../modules/instagram/backend/instagram-migrate';
import { growthMigrate } from '../modules/growth/backend/growth-migrate';
import { qrPaymentMigrate } from '../modules/qr-payment/backend/qr-payment-migrate';
import { telegramMigrate } from '../modules/telegram/backend/telegram-migrate';
import { messengerMigrate } from '../modules/messenger/backend/messenger-migrate';
import { tenantIsolationMigrate } from '../modules/users/backend/tenant-isolation-migrate';
import { smsMigrate } from '../modules/sms/backend/sms-migrate';
import { waChatMigrate } from '../modules/wa-chat/backend/wa-chat-migrate';
import { leadsMigrateV2 } from '../modules/leads/backend/leads-v2-migrate';
import { runBotMigration } from '../modules/bot-manager/backend/bot-migrate';

async function main() {
  console.log('\n🚀 Supabase Setup & Migration Script\n');
  console.log('═'.repeat(60));

  // Check Supabase configuration
  const supabaseStatus = getSupabaseStatus();
  console.log('\n📊 Supabase Configuration Status:');
  console.log(`   URL configured: ${supabaseStatus.url || '(not set)'}`);
  console.log(`   Anon key: ${supabaseStatus.hasAnonKey ? '✓' : '✗'}`);
  console.log(`   Service role key: ${supabaseStatus.hasServiceKey ? '✓' : '✗'}`);

  // Check DATABASE_URL
  const dbUrl = process.env.DATABASE_URL || '';
  const isSupabase = dbUrl.includes('supabase.com') || dbUrl.includes('supabase.co');
  
  console.log('\n📊 Database Connection:');
  console.log(`   Type: ${isSupabase ? 'Supabase' : 'Standard PostgreSQL'}`);
  console.log(`   URL: ${dbUrl ? dbUrl.replace(/:[^:@]+@/, ':****@') : '(not set)'}`);

  if (!dbUrl) {
    console.error('\n❌ DATABASE_URL is not set. Please configure it in .env');
    process.exit(1);
  }

  // Test connection
  console.log('\n🔍 Testing database connection...');
  const connected = await connectDb();
  
  if (!connected) {
    console.error('\n❌ Failed to connect to database');
    process.exit(1);
  }
  
  console.log('✅ Database connection successful!\n');

  // Run migrations
  console.log('═'.repeat(60));
  console.log('📦 Running all migrations...\n');

  const migrations: [string, () => Promise<void>][] = [
    ['Core schema', migrate],
    ['SaaS (tenants, users, subscriptions)', saasMigrate],
    ['Products v1 (funnel, booking, payment, review)', productsMigrate],
    ['Products v2 (events, catalog, survey, membership)', productsMigrateV2],
    ['Instagram automation', instagramMigrate],
    ['Growth platform', growthMigrate],
    ['WA-SaaS (drip, AI bot, orders, team inbox)', waSaasMigrate],
    ['QR Payment', qrPaymentMigrate],
    ['Telegram', telegramMigrate],
    ['Messenger', messengerMigrate],
    ['Tenant isolation', tenantIsolationMigrate],
    ['SMS module', smsMigrate],
    ['WhatsApp Live Chat', waChatMigrate],
    ['Leads v2', leadsMigrateV2],
    ['Bot Manager', runBotMigration],
  ];

  let successCount = 0;
  let failCount = 0;

  for (const [name, fn] of migrations) {
    try {
      process.stdout.write(`   • ${name}... `);
      await fn();
      console.log('✅');
      successCount++;
    } catch (err) {
      console.log(`⚠️  ${(err as Error).message.slice(0, 50)}`);
      failCount++;
    }
  }

  console.log('\n═'.repeat(60));
  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ⚠️  Warnings: ${failCount}`);

  // Verify tables
  console.log('\n🔍 Verifying tables...');
  const tableResult = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log(`   Found ${tableResult.rows.length} tables in database\n`);

  // List key tables
  const keyTables = [
    'tenants', 'users', 'campaigns', 'leads', 'whatsapp_messages',
    'sms_messages', 'email_messages', 'telegram_messages', 'messenger_messages',
    'instagram_accounts', 'automation_rules', 'bots'
  ];

  console.log('   Key tables status:');
  for (const table of keyTables) {
    const exists = tableResult.rows.some(r => r.table_name === table);
    console.log(`   ${exists ? '✅' : '❌'} ${table}`);
  }

  console.log('\n═'.repeat(60));
  console.log('\n✅ Supabase setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Update your .env with Supabase DATABASE_URL');
  console.log('  2. Optionally add SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  console.log('  3. Run: npm run api:dev\n');

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
