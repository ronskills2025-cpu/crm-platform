/**
 * scripts/env-setup.mjs — Environment setup automation
 *
 * Auto-copies .env.example → .env if missing.
 * Validates required variables on startup.
 *
 * Usage: node scripts/env-setup.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const envFile = path.join(root, '.env');
const envExample = path.join(root, '.env.example');

// ANSI colors
const R = '\x1b[31m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const C = '\x1b[36m';
const W = '\x1b[0m';

function log(color, label, msg) {
  console.log(`${color}[${label}]${W} ${msg}`);
}

// ── Step 1: Auto-copy .env ──────────────────────────────────────
if (!fs.existsSync(envFile)) {
  if (!fs.existsSync(envExample)) {
    log(R, 'ERROR', '.env.example not found! Cannot create .env');
    process.exit(1);
  }
  fs.copyFileSync(envExample, envFile);
  log(G, 'ENV', 'Created .env from .env.example');
  log(Y, 'ENV', 'Review .env and update values as needed');
} else {
  log(G, 'ENV', '.env file exists');
}

// ── Step 2: Validate required variables ─────────────────────────
const REQUIRED_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
];

const envContent = fs.readFileSync(envFile, 'utf-8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    envVars[key] = val;
  }
}

let hasErrors = false;
for (const key of REQUIRED_VARS) {
  if (!envVars[key]) {
    log(R, 'MISSING', `${key} is not set in .env`);
    hasErrors = true;
  }
}

if (hasErrors) {
  log(Y, 'WARN', 'Some required variables are missing. The app may not start correctly.');
  log(Y, 'HINT', 'Edit .env and fill in the missing values, or run: node setup-database.js');
} else {
  log(G, 'ENV', 'All required variables present');
}

// ── Step 3: Check for common issues ─────────────────────────────
if (envVars.JWT_SECRET === 'dev-secret-change-in-production') {
  log(Y, 'WARN', 'JWT_SECRET is using the default dev value. Change it for production!');
}

if (envVars.NODE_ENV === 'production') {
  log(C, 'INFO', 'Running in PRODUCTION mode');
} else {
  log(C, 'INFO', 'Running in DEVELOPMENT mode');
}

log(G, 'DONE', 'Environment setup complete');
