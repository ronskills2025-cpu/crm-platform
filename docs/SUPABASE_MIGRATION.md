# Supabase Migration Guide

This document describes how to migrate the CRM platform from a standard PostgreSQL database to Supabase.

## Overview

The CRM platform is fully compatible with Supabase since Supabase uses PostgreSQL. The migration involves:

1. **Database Connection**: Update `DATABASE_URL` to use Supabase connection string
2. **Schema Migration**: Run existing migrations against Supabase
3. **Optional Supabase Features**: Configure Supabase client for Auth, Realtime, Storage

## Quick Start

### Option 1: Interactive Setup

```bash
node setup-database.js
```

Select option 1 (Supabase) and follow the prompts.

### Option 2: Manual Setup

1. **Get your Supabase credentials**:
   - Go to [supabase.com](https://supabase.com)
   - Open your project → Settings → Database
   - Copy the "Connection string" (URI format)
   - Use "Transaction pooler" for best performance

2. **Update `.env`**:
   ```env
   # Database connection (required)
   DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
   
   # Supabase API (optional - for Supabase-specific features)
   SUPABASE_URL=https://[project-ref].supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Run migrations**:
   ```bash
   npm run db:supabase
   ```

4. **Start the server**:
   ```bash
   npm run api:dev
   ```

## Connection String Formats

### Supabase Transaction Pooler (Recommended)
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Supabase Session Pooler
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

### Direct Connection (Not recommended for serverless)
```
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

## Database Schema

The migration creates 100+ tables organized into modules:

### Core Tables
- `tenants` - Multi-tenant organizations
- `users` - User accounts with authentication
- `campaigns` - Marketing campaigns
- `leads` - Lead management
- `messages` - WhatsApp messages

### Channel-Specific Tables
- `whatsapp_messages`, `whatsapp_webhooks`
- `sms_messages`, `sms_dlt_entities`, `sms_dlt_templates`
- `email_messages`
- `telegram_messages`
- `messenger_messages`
- `instagram_accounts`, `instagram_messages`

### Module Tables
- **Products**: `automation_products`, `funnel_leads`, `booking_services`
- **Growth**: `lead_capture_forms`, `loyalty_programs`, `referral_programs`
- **WA-SaaS**: `wa_drip_campaigns`, `wa_ai_bot_configs`, `wa_orders`
- **Bot Manager**: `bots`, `bot_rules`, `bot_actions`, `bot_conversations`

## Using Supabase Features

### Supabase Client

The Supabase client is available for features like Auth, Realtime, and Storage:

```typescript
import { getSupabase, getSupabaseAdmin } from '@packages/db';

// For client-side operations (respects RLS)
const supabase = getSupabase();

// For server-side operations (bypasses RLS)
const supabaseAdmin = getSupabaseAdmin();
```

### Raw SQL Queries

For raw SQL queries, continue using the existing `pg` pool:

```typescript
import { query, pool } from '@packages/db';

// Simple query
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... queries
  await client.query('COMMIT');
} finally {
  client.release();
}
```

## Row Level Security (RLS)

If you want to enable Supabase RLS for additional security:

```sql
-- Enable RLS on a table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
CREATE POLICY "Tenant isolation" ON leads
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

## Troubleshooting

### Connection Errors

**SSL Error**: Make sure you're using the pooler connection string, not the direct connection.

**Timeout**: Increase `connectionTimeoutMillis` in pool config or check Supabase dashboard for connection limits.

### Migration Errors

**Table already exists**: Migrations use `CREATE TABLE IF NOT EXISTS`, so this is safe to ignore.

**Constraint errors**: Some constraints may fail if data already exists. Check the specific error message.

## Performance Tips

1. **Use Transaction Pooler**: Better for serverless and high-concurrency
2. **Connection Limits**: Supabase has connection limits based on plan. The pool is configured to stay within limits.
3. **Indexes**: All necessary indexes are created by migrations
4. **Query Optimization**: Use `EXPLAIN ANALYZE` in Supabase SQL Editor to optimize slow queries

## Rollback

To rollback to a standard PostgreSQL:

1. Update `DATABASE_URL` to your PostgreSQL connection string
2. Remove or clear `SUPABASE_*` environment variables
3. Restart the server

The codebase is designed to work with any PostgreSQL-compatible database.
