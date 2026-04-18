/**
 * scripts/start-dev.mjs — ONE-COMMAND local development startup
 *
 * Orchestrates all services: API, Workers, Web, Admin.
 * Requires local PostgreSQL and Redis to be running.
 *
 * Usage:
 *   npm run start:dev
 *   npm run dev
 *   node scripts/start-dev.mjs
 *
 * Prerequisites:
 *   - PostgreSQL running on localhost:5432
 *   - Redis running on localhost:6379
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── ANSI Colors ──────────────────────────────────────────────────
const R = '\x1b[31m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const C = '\x1b[36m';
const M = '\x1b[35m';
const B = '\x1b[1m';
const D = '\x1b[2m';
const W = '\x1b[0m';

// ── Service color prefixes ───────────────────────────────────────
const COLORS = {
  api:    '\x1b[36m',   // cyan
  worker: '\x1b[35m',   // magenta
  web:    '\x1b[32m',   // green
  admin:  '\x1b[33m',   // yellow
  db:     '\x1b[34m',   // blue
  redis:  '\x1b[31m',   // red
};

function prefix(name) {
  const color = COLORS[name] || W;
  return `${color}[${name.toUpperCase().padEnd(6)}]${W}`;
}

function banner() {
  console.log('');
  console.log(`${B}${C}╔══════════════════════════════════════════════════════╗${W}`);
  console.log(`${B}${C}║            CRM Platform — Development Mode           ║${W}`);
  console.log(`${B}${C}╚══════════════════════════════════════════════════════╝${W}`);
  console.log('');
}

// ── Utility functions ────────────────────────────────────────────
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

function commandExists(cmd) {
  try {
    execSync(`where ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ── Setup .env ───────────────────────────────────────────────────
function setupEnv() {
  const envFile = path.join(ROOT, '.env');
  const envExample = path.join(ROOT, '.env.example');

  if (!fs.existsSync(envFile)) {
    if (fs.existsSync(envExample)) {
      fs.copyFileSync(envExample, envFile);
      console.log(`${prefix('db')} Created .env from .env.example`);
    } else {
      console.log(`${R}${B}ERROR:${W} .env.example not found`);
      process.exit(1);
    }
  }
}

// ── Install dependencies ─────────────────────────────────────────
function installDeps() {
  const nodeModules = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    console.log(`${Y}Installing dependencies...${W}`);
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
    console.log(`${G}Dependencies installed${W}`);
  }
}

// ── Spawn a service with colored output ──────────────────────────
const children = [];

function spawnService(name, cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '1' },
    shell: true,
    ...options,
  });

  const pfx = prefix(name);

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.log(`${pfx} ${line}`);
    }
  });

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.log(`${pfx} ${R}${line}${W}`);
    }
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${pfx} ${R}${B}Process exited with code ${code}${W}`);
    }
  });

  children.push({ name, child });
  return child;
}

// ── Infrastructure validation ────────────────────────────────────
async function validateInfrastructure() {
  const pgUp = await checkPort(5432);
  const redisUp = await checkPort(6379);

  if (!pgUp) {
    console.log(`${R}${B}PostgreSQL not running${W} on localhost:5432`);
    console.log(`${D}Please start PostgreSQL and ensure it's accessible on port 5432${W}`);
  }

  if (!redisUp) {
    console.log(`${R}${B}Redis not running${W} on localhost:6379`);
    console.log(`${D}Please start Redis and ensure it's accessible on port 6379${W}`);
  }

  if (!pgUp || !redisUp) {
    console.log('');
    console.log(`${Y}${B}Setup Instructions:${W}`);
    if (!pgUp) {
      console.log(`${D}PostgreSQL:${W}`);
      console.log(`  • Install: https://www.postgresql.org/download/`);
      console.log(`  • Or use package manager: choco install postgresql (Windows)`);
      console.log(`  • Default port: 5432`);
    }
    if (!redisUp) {
      console.log(`${D}Redis:${W}`);
      console.log(`  • Install: https://redis.io/download`);
      console.log(`  • Or use package manager: choco install redis-64 (Windows)`);
      console.log(`  • Default port: 6379`);
    }
    console.log('');
    return false;
  }

  console.log(`${prefix('db')} ${G}PostgreSQL ready${W} on :5432`);
  console.log(`${prefix('redis')} ${G}Redis ready${W} on :6379`);
  return true;
}

// ── Main startup ─────────────────────────────────────────────────
async function main() {
  banner();

  // Step 1: Environment
  setupEnv();
  installDeps();
  console.log('');

  // Step 2: Validate infrastructure
  const infraOk = await validateInfrastructure();
  if (!infraOk) {
    console.log(`${R}${B}Infrastructure check failed.${W} Please start the required services and try again.`);
    process.exit(1);
  }

  console.log('');

  // Step 3: Start API server
  console.log(`${prefix('api')} Starting API server...`);
  spawnService('api', 'npx', ['tsx', 'watch', 'apps/api/src/server.ts']);

  // Wait for API to be ready before starting dependents
  try {
    await waitForPort(4000, 'API', 30, 2000);
    console.log(`${prefix('api')} ${G}${B}API running${W} on ${C}http://localhost:4000${W}`);
  } catch {
    console.log(`${prefix('api')} ${R}API failed to start. Check logs above.${W}`);
  }

  // Step 4: Start workers
  console.log(`${prefix('worker')} Starting background workers...`);
  spawnService('worker', 'npx', ['tsx', 'watch', 'scripts/worker-entry.ts']);

  // Step 5: Start frontend
  console.log(`${prefix('web')} Starting frontend...`);
  spawnService('web', 'npx', ['vite', '--config', 'apps/web/vite.config.ts']);

  // Step 6: Start admin
  console.log(`${prefix('admin')} Starting admin panel...`);
  spawnService('admin', 'npx', ['vite', '--config', 'apps/admin/vite.config.ts']);

  // Wait for frontend services
  await Promise.allSettled([
    waitForPort(5173, 'Frontend', 20, 2000).then(() => {
      console.log(`${prefix('web')} ${G}${B}Frontend running${W} on ${C}http://localhost:5173${W}`);
    }),
    waitForPort(5174, 'Admin', 20, 2000).then(() => {
      console.log(`${prefix('admin')} ${G}${B}Admin panel running${W} on ${C}http://localhost:5174${W}`);
    }),
  ]);

  // ── Startup summary ──────────────────────────────────────────
  console.log('');
  console.log(`${B}${G}╔══════════════════════════════════════════════════════╗${W}`);
  console.log(`${B}${G}║              All services started!                    ║${W}`);
  console.log(`${B}${G}╠══════════════════════════════════════════════════════╣${W}`);
  console.log(`${B}${G}║${W}  ${C}API Server${W}    →  http://localhost:4000              ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${C}Frontend${W}      →  http://localhost:5173              ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${C}Admin Panel${W}   →  http://localhost:5174              ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${C}PostgreSQL${W}    →  localhost:5432                     ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${C}Redis${W}         →  localhost:6379                     ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${C}WebSocket${W}     →  ws://localhost:4000/ws             ${B}${G}║${W}`);
  console.log(`${B}${G}╠══════════════════════════════════════════════════════╣${W}`);
  console.log(`${B}${G}║${W}  ${D}Health check: npm run health${W}                        ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${D}Seed data:    npm run db:seed${W}                       ${B}${G}║${W}`);
  console.log(`${B}${G}║${W}  ${D}Press Ctrl+C to stop all services${W}                   ${B}${G}║${W}`);
  console.log(`${B}${G}╚══════════════════════════════════════════════════════╝${W}`);
  console.log('');

  // Run seed if DB was just created (first-time setup)
  try {
    const seedMarker = path.join(ROOT, 'node_modules', '.crm-seeded');
    if (!fs.existsSync(seedMarker)) {
      console.log(`${prefix('db')} ${Y}First run detected — seeding database...${W}`);
      // Give API a moment to run migrations
      await new Promise(r => setTimeout(r, 5000));
      const seedProc = spawn('npx', ['tsx', 'scripts/seed.ts'], {
        cwd: ROOT,
        env: process.env,
        shell: true,
      });
      seedProc.stdout?.on('data', (d) => console.log(`${prefix('db')} ${d.toString().trim()}`));
      seedProc.stderr?.on('data', (d) => console.log(`${prefix('db')} ${R}${d.toString().trim()}${W}`));
      seedProc.on('exit', (code) => {
        if (code === 0) {
          fs.writeFileSync(seedMarker, new Date().toISOString());
          console.log(`${prefix('db')} ${G}Database seeded successfully${W}`);
          console.log(`${prefix('db')} ${D}Admin login: admin@crm.local / admin123${W}`);
        }
      });
    }
  } catch {
    // Non-critical — seed can be run manually
  }
}

// ── Graceful shutdown ────────────────────────────────────────────
function shutdown() {
  console.log('');
  console.log(`${Y}${B}Shutting down all services...${W}`);

  for (const { name, child } of children) {
    try {
      child.kill('SIGTERM');
      console.log(`${prefix(name)} stopped`);
    } catch {
      // Already exited
    }
  }

  console.log(`${G}All services stopped.${W}`);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run
main().catch((err) => {
  console.error(`${R}${B}Startup failed:${W}`, err.message);
  process.exit(1);
});
