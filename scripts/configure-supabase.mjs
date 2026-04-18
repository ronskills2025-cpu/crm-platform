/**
 * One-shot Supabase env configurator.
 * Updates .env with provided Supabase credentials without overwriting other keys.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

const updates = {
  DATABASE_URL: 'postgresql://postgres.witlnwdfspbcujndrmga:1qaz0plm1qaz@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres',
  SUPABASE_URL: 'https://witlnwdfspbcujndrmga.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdGxud2Rmc3BiY3VqbmRybWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTUxODksImV4cCI6MjA5MjA3MTE4OX0.LkA0XCV_BhPy94g0SgOBgJow-khg3ag9xUVisktTeY0',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdGxud2Rmc3BiY3VqbmRybWdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ5NTE4OSwiZXhwIjoyMDkyMDcxMTg5fQ.CINTekbEg78AhrWxQkU2FlRjyWXtiYz94eiBypotijQ',
};

let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

for (const [key, value] of Object.entries(updates)) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
    console.log(`  ✔ Updated ${key}`);
  } else {
    // Append missing keys at the end
    content += `\n${key}=${value}`;
    console.log(`  ✚ Added ${key}`);
  }
}

fs.writeFileSync(envPath, content, 'utf8');
console.log('\n✅ .env updated with Supabase credentials');
