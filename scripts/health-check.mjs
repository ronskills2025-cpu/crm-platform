/**
 * scripts/health-check.mjs — Service health checker
 *
 * Checks all services and reports status.
 * Usage: node scripts/health-check.mjs
 *        npm run health
 */

import http from 'http';
import net from 'net';

const R = '\x1b[31m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const C = '\x1b[36m';
const D = '\x1b[2m';
const W = '\x1b[0m';
const B = '\x1b[1m';

function checkTcp(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeout);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.connect(port, host);
  });
}

function checkHttp(url, timeout = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, data: JSON.parse(data) });
        } catch {
          resolve({ ok: res.statusCode === 200, data: null });
        }
      });
    });
    req.on('error', () => resolve({ ok: false, data: null }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, data: null }); });
  });
}

async function main() {
  console.log('');
  console.log(`${B}${C}╔══════════════════════════════════════════╗${W}`);
  console.log(`${B}${C}║      CRM Platform — Health Check         ║${W}`);
  console.log(`${B}${C}╚══════════════════════════════════════════╝${W}`);
  console.log('');

  const checks = [
    { name: 'PostgreSQL', check: () => checkTcp('localhost', 5432), port: 5432 },
    { name: 'Redis', check: () => checkTcp('localhost', 6379), port: 6379 },
    { name: 'API Server', check: () => checkHttp('http://localhost:4000/health'), port: 4000, isHttp: true },
    { name: 'Frontend', check: () => checkTcp('localhost', 5173), port: 5173 },
    { name: 'Admin Panel', check: () => checkTcp('localhost', 5174), port: 5174 },
  ];

  let allOk = true;

  for (const svc of checks) {
    const result = await svc.check();
    const ok = svc.isHttp ? result.ok : result;
    const icon = ok ? `${G}✓` : `${R}✗`;
    const status = ok ? `${G}running` : `${R}not responding`;
    console.log(`  ${icon} ${B}${svc.name}${W}  ${D}:${svc.port}${W}  ${status}${W}`);

    if (svc.isHttp && result.data) {
      const d = result.data;
      if (d.redis !== undefined) {
        console.log(`    ${D}├─ Redis: ${d.redis ? `${G}connected` : `${Y}disconnected`}${W}`);
      }
      if (d.wsClients !== undefined) {
        console.log(`    ${D}└─ WebSocket clients: ${d.wsClients}${W}`);
      }
    }

    if (!ok) allOk = false;
  }

  console.log('');
  if (allOk) {
    console.log(`  ${G}${B}All services healthy!${W}`);
  } else {
    console.log(`  ${Y}${B}Some services are not running.${W}`);
    console.log(`  ${D}Run 'npm run start:all' to start all services.${W}`);
  }
  console.log('');
}

main();
