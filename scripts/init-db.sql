-- ═══════════════════════════════════════════════════════════════
-- init-db.sql — PostgreSQL initialization
-- ═══════════════════════════════════════════════════════════════
-- Creates extensions needed by the CRM.
-- Run this on your PostgreSQL database before first use.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
