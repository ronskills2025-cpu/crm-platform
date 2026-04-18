#!/usr/bin/env node
/**
 * Complete Project Setup & Startup Script
 * 
 * This script handles everything needed to run the CRM platform:
 * 1. Dependency installation
 * 2. Environment setup
 * 3. Database configuration and migration
 * 4. Service startup with health checks
 * 
 * Usage: npm run start:all
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── ANSI Colors ──────────────────────────────────────────────────
const R = '\x1b[31m', G = '\x1b[32m', Y = '\x1b[33m', C = '\x1b[36m';
const M = '\x1b[35m', B = '\x1b[1m', D = '\x1b[2m', W = '\x1b[0m';

const COLORS = {
  setup: '\x1b[34m',   // blue
  api: '\x1b[36m',     // cyan
  worker: '\x1b[35m',  // magenta
  web: '\x1b[32m',     // green
  admin: '\x1b[33m',   // yellow
  db: '\x1b[34m',      // blue
};

function log(service, message) {
  const color = COLORS[service] || W;
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${service.toUpperCase().padEnd(6)}]${W} ${D}${timestamp}${W} ${message}`);
}

function banner() {
  console.log('');
  console.log(`${B}${C}╔══════════════════════════════════════════════════════╗${W}`);
  console.log(`${B}${C}║          CRM Platform — Complete Setup              ║${W}`);
  console.log(`${B}${C}╚══════════════════════════════════════════════════════╝${W}`);
  console.log('');
}

// ── Utility Functions ────────────────────────────────────────────
function checkPort(port, timeout = 2000) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeout);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.connect(port, '127.0.0.1');
  });
}

function waitForPort(port, label, maxRetries = 30, interval = 2000) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const check = async () => {
      attempt++;
      const up = await checkPort(port);
      if (up) {
        resolve(true);
      } else if (attempt >= maxRetries) {
        reject(new Error(`${label} on port ${port} did not start after ${maxRetries * interval / 1000}s`));
      } else {
        setTimeout(check, interval);
      }
    };
    check();
  });
}

function question(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ── Step 1: Install Dependencies ─────────────────────────────────
async function installDependencies() {
  log('setup', 'Checking dependencies...');
  
  const nodeModules = path.join(ROOT, 'node_modules');
  const packageLock = path.join(ROOT, 'package-lock.json');
  
  if (!fs.existsSync(nodeModules) || !fs.existsSync(packageLock)) {
    log('setup', 'Installing dependencies... (this may take a few minutes)');
    try {
      execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
      log('setup', `${G}Dependencies installed successfully${W}`);
    } catch (error) {
      log('setup', `${R}Failed to install dependencies: ${error.message}${W}`);
      process.exit(1);
    }
  } else {
    log('setup', `${G}Dependencies already installed${W}`);
  }
}

// ── Step 2: Environment Setup ────────────────────────────────────
async function setupEnvironment() {
  log('setup', 'Setting up environment...');
  
  const envFile = path.join(ROOT, '.env');
  const envExample = path.join(ROOT, '.env.example');
  
  if (!fs.existsSync(envFile)) {
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envFile);
      log('setup', 'Created .env from .env.example');
    } else {
      log('setup', `${R}No .env.example found${W}`);
      process.exit(1);
    }
  }
  
  // Check if database is configured
  const envContent = fs.readFileSync(envFile, 'utf8');
  const hasSupabase = envContent.includes('SUPABASE_URL=') && !envContent.includes('SUPABASE_URL=\n') && !envContent.includes('SUPABASE_URL=');
  const hasPostgres = envContent.includes('postgresql://') && !envContent.includes('postgresql://crm:crm_secret@localhost');
  const hasSQLite = envContent.includes('sqlite:');
  
  if (!hasSupabase && !hasPostgres && !hasSQLite) {
    log('setup', `${Y}Database not configured. Starting interactive setup...${W}`);
    await configureDatabaseInteractive();
  } else {
    log('setup', `${G}Database configuration found${W}`);
    
    // If using SQLite as fallback, ensure it's properly configured
    if (hasSQLite && !hasSupabase && !hasPostgres) {
      log('setup', `${C}Using SQLite database (development mode)${W}`);
    }
  }
}

async function configureDatabaseInteractive() {
  console.log('\n🗄️ Database Configuration Required\n');
  console.log('Choose your database setup:');
  console.log('  1. Supabase (recommended - free tier available)');
  console.log('  2. Neon PostgreSQL (free tier available)');
  console.log('  3. Local PostgreSQL (requires local installation)');
  console.log('  4. Use SQLite (development only)\n');
  
  const choice = await question('Enter your choice (1-4): ');
  
  let databaseUrl = '';
  let supabaseUrl = '';
  let supabaseAnonKey = '';
  let supabaseServiceKey = '';
  
  switch (choice.trim()) {
    case '1':
      console.log('\n📦 Supabase Setup');
      console.log('1. Go to https://supabase.com → Create project');
      console.log('2. Get your project URL and keys from Settings > API\n');
      
      supabaseUrl = await question('Supabase Project URL: ');
      supabaseAnonKey = await question('Supabase Anon Key: ');
      supabaseServiceKey = await question('Supabase Service Role Key: ');
      
      // Extract connection string format
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
      const password = await question('Database Password: ');
      databaseUrl = `postgresql://postgres.${projectRef}:${password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;
      break;
      
    case '2':
      console.log('\n📦 Neon Setup');
      console.log('1. Go to https://neon.tech → Create project');
      console.log('2. Copy the connection string from the dashboard\n');
      databaseUrl = await question('Neon DATABASE_URL: ');
      break;
      
    case '3':
      console.log('\n🗄️ Local PostgreSQL');
      console.log('Make sure PostgreSQL is installed and running locally.\n');
      databaseUrl = 'postgresql://crm:crm_secret@localhost:5432/crm_dev';
      break;
      
    case '4':
      console.log('\n📁 SQLite (Development Only)');
      databaseUrl = 'sqlite:./data/crm.db';
      break;
      
    default:
      log('setup', `${R}Invalid choice. Exiting.${W}`);
      process.exit(1);
  }
  
  // Update .env file
  const envFile = path.join(ROOT, '.env');
  let envContent = fs.readFileSync(envFile, 'utf8');
  
  envContent = envContent.replace(/DATABASE_URL=.*/, `DATABASE_URL=${databaseUrl}`);
  
  if (supabaseUrl) {
    envContent = envContent.replace(/SUPABASE_URL=.*/, `SUPABASE_URL=${supabaseUrl}`);
    envContent = envContent.replace(/SUPABASE_ANON_KEY=.*/, `SUPABASE_ANON_KEY=${supabaseAnonKey}`);
    envContent = envContent.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/, `SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}`);
  }
  
  fs.writeFileSync(envFile, envContent);
  log('setup', `${G}Database configuration saved${W}`);
}

// ── Step 3: Database Migration ───────────────────────────────────
async function runMigrations() {
  log('db', 'Running database migrations...');
  
  try {
    const envFile = path.join(ROOT, '.env');
    const envContent = fs.readFileSync(envFile, 'utf8');
    
    // Check database type
    const isSupabase = envContent.includes('supabase.com') || envContent.includes('supabase.co');
    const isNeon = envContent.includes('neon.tech');
    const isCloudDB = isSupabase || isNeon;
    
    if (isSupabase) {
      log('db', `${C}Supabase database detected${W}`);
    } else if (isNeon) {
      log('db', `${C}Neon database detected${W}`);
    }
    
    // Test database connection
    try {
      log('db', 'Testing database connection...');
      execSync('npx tsx -e "import { pool } from \'./packages/db/src/connection\'; pool.query(\'SELECT 1\').then(() => { console.log(\'DB OK\'); process.exit(0); }).catch(e => { console.error(e.message); process.exit(1); });"', 
        { cwd: ROOT, stdio: 'pipe', timeout: 15000 });
      log('db', `${G}Database connection successful${W}`);
    } catch (connError) {
      log('db', `${R}Database connection failed${W}`);
      if (!isCloudDB) {
        log('db', `${Y}Please configure a valid DATABASE_URL in .env${W}`);
        log('db', `${Y}Options: Supabase, Neon, or local PostgreSQL${W}`);
      }
      throw new Error('Database connection failed');
    }
    
    // Run core migrations
    log('db', 'Running core migrations...');
    execSync('npx tsx packages/db/src/migrate.ts', { cwd: ROOT, stdio: 'inherit', timeout: 60000 });
    
    // Run module migrations
    const moduleScripts = [
      'modules/users/backend/tenant-isolation-migrate.ts',
      'modules/products/backend/products-migrate.ts',
      'modules/products/backend/products-migrate-v2.ts',
      'modules/instagram/backend/instagram-migrate.ts',
      'modules/wa-chat/backend/wa-chat-migrate.ts'
    ];
    
    for (const script of moduleScripts) {
      const scriptPath = path.join(ROOT, script);
      if (fs.existsSync(scriptPath)) {
        log('db', `Running ${path.basename(script)}...`);
        try {
          execSync(`npx tsx ${script}`, { cwd: ROOT, stdio: 'inherit', timeout: 30000 });
        } catch (scriptError) {
          log('db', `${Y}Warning: ${path.basename(script)} - continuing${W}`);
        }
      }
    }
    
    log('db', `${G}Database migrations completed${W}`);
  } catch (error) {
    log('db', `${R}Migration error: ${error.message}${W}`);
    throw error;
  }
}

// ── Step 4: Seed Initial Data ────────────────────────────────────
async function seedDatabase() {
  log('db', 'Seeding initial data...');
  
  const seedMarker = path.join(ROOT, 'node_modules', '.crm-seeded');
  if (fs.existsSync(seedMarker)) {
    log('db', 'Database already seeded');
    return;
  }
  
  try {
    execSync('npx tsx scripts/seed.ts', { cwd: ROOT, stdio: 'inherit' });
    fs.writeFileSync(seedMarker, new Date().toISOString());
    log('db', `${G}Database seeded successfully${W}`);
    log('db', `${C}Default admin login: admin@msgcrm.com / Admin@1234${W}`);
  } catch (error) {
    log('db', `${Y}Seeding failed (non-critical): ${error.message}${W}`);
  }
}

// ── Step 5: Start Services ───────────────────────────────────────
const children = [];

function spawnService(name, cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '1' },
    shell: true,
    ...options,
  });

  const color = COLORS[name] || W;

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.log(`${color}[${name.toUpperCase().padEnd(6)}]${W} ${line}`);
    }
  });

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.log(`${color}[${name.toUpperCase().padEnd(6)}]${W} ${R}${line}${W}`);
    }
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      log(name, `${R}Process exited with code ${code}${W}`);
    }
  });

  children.push({ name, child });
  return child;
}

async function startServices() {
  log('setup', 'Starting all services...');
  
  // Start API server
  log('api', 'Starting API server...');
  spawnService('api', 'npx', ['tsx', 'watch', 'apps/api/src/server.ts']);
  
  // Wait for API to be ready
  try {
    await waitForPort(4000, 'API', 30, 2000);
    log('api', `${G}API server running on http://localhost:4000${W}`);
  } catch (error) {
    log('api', `${R}API failed to start: ${error.message}${W}`);
  }
  
  // Start workers
  log('worker', 'Starting background workers...');
  spawnService('worker', 'npx', ['tsx', 'watch', 'scripts/worker-entry.ts']);
  
  // Start frontend
  log('web', 'Starting frontend...');
  spawnService('web', 'npx', ['vite', '--config', 'apps/web/vite.config.ts']);
  
  // Start admin panel
  log('admin', 'Starting admin panel...');
  spawnService('admin', 'npx', ['vite', '--config', 'apps/admin/vite.config.ts']);
  
  // Wait for frontend services
  await Promise.allSettled([
    waitForPort(5173, 'Frontend', 20, 2000).then(() => {
      log('web', `${G}Frontend running on http://localhost:5173${W}`);
    }).catch(() => {
      // Try alternative port
      waitForPort(5174, 'Frontend', 5, 1000).then(() => {
        log('web', `${G}Frontend running on http://localhost:5174${W}`);
      }).catch(() => {
        log('web', `${Y}Frontend may be on a different port${W}`);
      });
    }),
    waitForPort(5174, 'Admin', 20, 2000).then(() => {
      log('admin', `${G}Admin panel running on http://localhost:5174${W}`);
    }).catch(() => {
      // Try alternative port
      waitForPort(5175, 'Admin', 5, 1000).then(() => {
        log('admin', `${G}Admin panel running on http://localhost:5175${W}`);
      }).catch(() => {
        log('admin', `${Y}Admin panel may be on a different port${W}`);
      });
    }),
  ]);
}

// ── Step 6: Show Summary ─────────────────────────────────────────
function showSummary() {
  console.log('');
  console.log(`${B}${G}╔══════════════════════════════════════════════════════╗${W}`);
  console.log(`${B}${G}║                🚀 CRM Platform Ready!                ║${W}`);
  console.log(`${B}${G}╠══════════════════════════════════════════════════════╣${W}`);
  console.log(`${B}${G}║${W}  ${C}Frontend${W}      →  http://localhost:5173 (or 5174)     ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${C}Admin Panel${W}   →  http://localhost:5174 (or 5175)     ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${C}API Server${W}    →  http://localhost:4000              ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${C}Health Check${W}  →  http://localhost:4000/health       ${B}${G}║${W}`);
  console.log(`${B}${G}╠══════════════════════════════════════════════════════╣${W}`);
  console.log(`${B}${G}║${W}  ${D}Default Admin: admin@msgcrm.com / Admin@1234${W}        ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${D}Press Ctrl+C to stop all services${W}                   ${B}${G}║${W}`);
  console.log(`${B}${G}╚══════════════════════════════════════════════════════╝${W}`);
  console.log('');
}

// ── Graceful Shutdown ────────────────────────────────────────────
function shutdown() {
  console.log('');
  log('setup', `${Y}Shutting down all services...${W}`);
  
  for (const { name, child } of children) {
    try {
      child.kill('SIGTERM');
      log(name, 'Stopped');
    } catch {
      // Already exited
    }
  }
  
  log('setup', `${G}All services stopped${W}`);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Main Execution ───────────────────────────────────────────────
async function main() {
  try {
    banner();
    
    await installDependencies();
    await setupEnvironment();
    await runMigrations();
    await seedDatabase();
    await startServices();
    
    showSummary();
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    log('setup', `${R}Setup failed: ${error.message}${W}`);
    console.error(error);
    process.exit(1);
  }
}

main();
