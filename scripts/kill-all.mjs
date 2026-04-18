#!/usr/bin/env node
/**
 * Kill All CRM Processes Script
 * 
 * Kills all running CRM-related processes on common ports
 * Usage: npm run kill:all
 */

import { execSync } from 'child_process';

const ports = [4000, 5173, 5174, 5175, 5176, 5177, 5178];

console.log('🔴 Stopping all CRM processes...\n');

let killedCount = 0;

// Kill processes by port
for (const port of ports) {
  try {
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    
    if (result) {
      const lines = result.split('\n').filter(line => line.includes('LISTENING'));
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        
        if (pid && pid !== '0' && !isNaN(pid)) {
          try {
            execSync(`taskkill /PID ${pid} /F`);
            console.log(`✅ Killed process on port ${port} (PID: ${pid})`);
            killedCount++;
          } catch (error) {
            console.log(`⚠️  Could not kill process on port ${port} (PID: ${pid})`);
          }
        }
      }
    }
  } catch (error) {
    // No process on this port, continue
  }
}

// Kill common development processes
const processCommands = [
  'taskkill /F /IM "tsx.exe" 2>nul',
  'taskkill /F /IM "vite.exe" 2>nul', 
  'taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq *tsx*" 2>nul',
  'taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq *vite*" 2>nul'
];

for (const cmd of processCommands) {
  try {
    execSync(cmd);
    console.log(`✅ Killed development processes`);
    killedCount++;
  } catch (error) {
    // Process not found, continue
  }
}

if (killedCount === 0) {
  console.log('ℹ️  No CRM processes were running');
} else {
  console.log(`\n🟢 Stopped ${killedCount} processes!`);
}

console.log('\nYou can now run: npm run start:all');
