/**
 * Quick Start - CRM API with Native Setup
 * 
 * This starts the API server with native PostgreSQL and Redis
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting CRM System...\n');

// Set environment variables for mock mode
process.env.NODE_ENV = 'development';
process.env.PORT = '3000';
process.env.FRONTEND_URL = 'http://localhost:5173,http://localhost:5174';
process.env.LOG_LEVEL = 'info';
process.env.DATABASE_URL = 'mock://localhost/crm_demo';
process.env.REDIS_URL = 'mock://localhost:6379';

// Mock database flag
process.env.MOCK_MODE = 'true';

console.log('📊 Configuration:');
console.log('   Port: 3000');
console.log('   Mode: Development (Mock Database)');
console.log('   Frontend: http://localhost:5173');
console.log('');

// Start the API server
const apiPath = path.join(__dirname, 'apps', 'api', 'src', 'server.ts');
const apiProcess = spawn('npx', ['tsx', apiPath], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env }
});

apiProcess.on('error', (err) => {
  console.error('❌ Failed to start API server:', err.message);
  process.exit(1);
});

apiProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ API server exited with code ${code}`);
  }
  process.exit(code);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  apiProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  apiProcess.kill('SIGTERM');
});

console.log('✅ Starting API server...');
console.log('📡 API will be available at: http://localhost:3000');
console.log('🔍 Health check: http://localhost:3000/health');
console.log('🤖 Bot stats: http://localhost:3000/api/bots/stats');
console.log('\nPress Ctrl+C to stop\n');
