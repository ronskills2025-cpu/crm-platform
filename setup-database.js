/**
 * Database Setup Helper
 * 
 * This script helps configure the database connection for the CRM system.
 * Run this to set up your database connection.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🔧 CRM Database Setup\n');
  console.log('This will configure your database connection.\n');
  console.log('Options:');
  console.log('  1. Supabase (recommended for production)');
  console.log('  2. Neon PostgreSQL');
  console.log('  3. Local PostgreSQL');
  console.log('  4. Custom PostgreSQL URL\n');

  const choice = await question('Enter your choice (1-4): ');

  let databaseUrl = '';
  let supabaseUrl = '';
  let supabaseAnonKey = '';
  let supabaseServiceKey = '';

  switch (choice.trim()) {
    case '1':
      console.log('\n📦 Supabase Setup');
      console.log('═'.repeat(50));
      console.log('\nStep 1: Get your DATABASE_URL');
      console.log('  → Go to https://supabase.com');
      console.log('  → Open your project → Settings → Database');
      console.log('  → Copy "Connection string" (URI format)');
      console.log('  → Use "Transaction pooler" for best performance\n');
      databaseUrl = await question('Paste your DATABASE_URL: ');
      
      console.log('\nStep 2: Get your API keys (optional but recommended)');
      console.log('  → Go to Settings → API');
      console.log('  → Copy "Project URL" and API keys\n');
      
      const setupKeys = await question('Do you want to configure Supabase API keys? (y/n): ');
      if (setupKeys.toLowerCase() === 'y') {
        supabaseUrl = await question('SUPABASE_URL (Project URL): ');
        supabaseAnonKey = await question('SUPABASE_ANON_KEY (anon public): ');
        supabaseServiceKey = await question('SUPABASE_SERVICE_ROLE_KEY (service_role): ');
      }
      break;

    case '2':
      console.log('\n📦 Neon Setup');
      console.log('Go to https://neon.tech → Create project → Connection Details');
      console.log('Copy the connection string\n');
      databaseUrl = await question('Paste your Neon DATABASE_URL: ');
      break;

    case '3':
      console.log('\n�️ Local PostgreSQL');
      console.log('Make sure PostgreSQL is installed and running locally.');
      console.log('Default connection assumes:');
      console.log('  - Host: localhost');
      console.log('  - Port: 5432');
      console.log('  - Database: crm_dev');
      console.log('  - User: crm');
      console.log('  - Password: crm_secret\n');
      databaseUrl = 'postgresql://crm:crm_secret@localhost:5432/crm_dev';
      break;

    case '4':
      console.log('\n📦 Custom PostgreSQL');
      console.log('Format: postgresql://user:password@host:port/database\n');
      databaseUrl = await question('Enter your DATABASE_URL: ');
      break;

    default:
      console.log('Invalid choice. Exiting.');
      rl.close();
      process.exit(1);
  }

  // Update .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    // Replace existing DATABASE_URL
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${databaseUrl}`);
    } else {
      envContent += `\nDATABASE_URL=${databaseUrl}\n`;
    }
    // Update Supabase keys if provided
    if (supabaseUrl) {
      if (envContent.includes('SUPABASE_URL=')) {
        envContent = envContent.replace(/SUPABASE_URL=.*/g, `SUPABASE_URL=${supabaseUrl}`);
      } else {
        envContent += `SUPABASE_URL=${supabaseUrl}\n`;
      }
    }
    if (supabaseAnonKey) {
      if (envContent.includes('SUPABASE_ANON_KEY=')) {
        envContent = envContent.replace(/SUPABASE_ANON_KEY=.*/g, `SUPABASE_ANON_KEY=${supabaseAnonKey}`);
      } else {
        envContent += `SUPABASE_ANON_KEY=${supabaseAnonKey}\n`;
      }
    }
    if (supabaseServiceKey) {
      if (envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
        envContent = envContent.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/g, `SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}`);
      } else {
        envContent += `SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}\n`;
      }
    }
  } else {
    // Create new .env from example
    const examplePath = path.join(__dirname, '.env.example');
    if (fs.existsSync(examplePath)) {
      envContent = fs.readFileSync(examplePath, 'utf8');
      envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${databaseUrl}`);
      if (supabaseUrl) envContent = envContent.replace(/SUPABASE_URL=.*/g, `SUPABASE_URL=${supabaseUrl}`);
      if (supabaseAnonKey) envContent = envContent.replace(/SUPABASE_ANON_KEY=.*/g, `SUPABASE_ANON_KEY=${supabaseAnonKey}`);
      if (supabaseServiceKey) envContent = envContent.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/g, `SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}`);
    } else {
      envContent = `DATABASE_URL=${databaseUrl}\n`;
      if (supabaseUrl) envContent += `SUPABASE_URL=${supabaseUrl}\n`;
      if (supabaseAnonKey) envContent += `SUPABASE_ANON_KEY=${supabaseAnonKey}\n`;
      if (supabaseServiceKey) envContent += `SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey}\n`;
    }
  }

  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ .env file updated');

  // Test connection
  console.log('\n🔍 Testing database connection...');
  
  try {
    const { Pool } = require('pg');
    const isSupabase = databaseUrl.includes('supabase.com') || databaseUrl.includes('supabase.co');
    const pool = new Pool({ 
      connectionString: databaseUrl,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined
    });
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    console.log('✅ Database connection successful!\n');
    
    if (isSupabase) {
      console.log('🎉 Supabase connection verified!');
      console.log('\nNext steps:');
      console.log('  1. Run migrations: npm run db:supabase');
      console.log('  2. Start the server: npm run api:dev\n');
    } else {
      console.log('You can now start the backend with:');
      console.log('  npm run api:dev\n');
    }
  } catch (err) {
    console.log(`❌ Database connection failed: ${err.message}\n`);
    console.log('Please check your connection string and try again.');
    if (err.message.includes('SSL')) {
      console.log('\nTip: Make sure you\'re using the correct connection string format.');
      console.log('For Supabase, use the "Transaction pooler" connection string.');
    }
  }

  rl.close();
}

main().catch(console.error);
