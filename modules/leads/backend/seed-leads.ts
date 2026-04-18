/**
 * Seed 1000 realistic leads across all 6 channels.
 * Run: npx ts-node src/db/seed-leads.ts
 */
import { pool } from '../../../packages/db/src/connection';

const NIL_TENANT = '00000000-0000-0000-0000-000000000000';

const CHANNELS = ['whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram'] as const;
const STATUSES = ['new', 'contacted', 'converted', 'lost'] as const;
const SEGMENTS = ['hot', 'warm', 'cold'] as const;
const SOURCES = ['whatsapp', 'sms', 'email', 'telegram', 'messenger', 'instagram', 'referral', 'website', 'ad_campaign', 'manual'] as const;

const FIRST_NAMES = [
  'Aarav', 'Aisha', 'Arjun', 'Bella', 'Carlos', 'Divya', 'Elena', 'Fatima', 'George', 'Hannah',
  'Ivan', 'Jasmine', 'Kevin', 'Layla', 'Marco', 'Nadia', 'Omar', 'Priya', 'Quinn', 'Ravi',
  'Sofia', 'Tariq', 'Uma', 'Victor', 'Wendy', 'Xavier', 'Yuki', 'Zara', 'Ahmed', 'Beatrice',
  'Chen', 'Diana', 'Eduardo', 'Fatou', 'Gabriel', 'Helena', 'Ibrahim', 'Julia', 'Krishna', 'Lena',
  'Mohammed', 'Nina', 'Oscar', 'Petra', 'Rafael', 'Sara', 'Thomas', 'Uri', 'Valentina', 'William',
];

const LAST_NAMES = [
  'Ali', 'Brown', 'Chen', 'Das', 'Edwards', 'Ferreira', 'Garcia', 'Hussain', 'Ibrahim', 'Johnson',
  'Kim', 'Lopez', 'Malik', 'Nguyen', 'Okafor', 'Patel', 'Qureshi', 'Rodriguez', 'Singh', 'Thomas',
  'Usman', 'Vasquez', 'Wang', 'Xavier', 'Yang', 'Zuberi', 'Ahmed', 'Bakr', 'Costa', 'Diallo',
];

const TAG_POOL = ['enterprise', 'smb', 'startup', 'student', 'premium', 'trial', 'churned',
  'upsell', 'renewal', 'support', 'api_user', 'mobile', 'desktop', 'referred'];

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randN(n: number) {
  return Math.floor(Math.random() * n);
}

function weightedStatus(): typeof STATUSES[number] {
  const r = Math.random();
  if (r < 0.35) return 'new';
  if (r < 0.65) return 'contacted';
  if (r < 0.85) return 'converted';
  return 'lost';
}

function weightedSegment(): typeof SEGMENTS[number] {
  const r = Math.random();
  if (r < 0.20) return 'hot';
  if (r < 0.55) return 'warm';
  return 'cold';
}

function generatePhone(countryCode = '+1'): string {
  const area = 200 + randN(800);
  const prefix = 200 + randN(800);
  const line = 1000 + randN(9000);
  return `${countryCode}${area}${prefix}${line}`;
}

function generateEmail(first: string, last: string): string {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'business.io', 'company.co'];
  const sep = rand(['.', '_', '']);
  const n = randN(100) > 50 ? String(randN(99) + 1) : '';
  return `${first.toLowerCase()}${sep}${last.toLowerCase()}${n}@${rand(domains)}`;
}

function generateContactValue(channel: typeof CHANNELS[number], first: string, last: string, i: number): string {
  switch (channel) {
    case 'whatsapp':
    case 'sms':
      return generatePhone(rand(['+1', '+44', '+91', '+61', '+971', '+49', '+33'])).replace(/\D/g, '');
    case 'email':
      return generateEmail(first, last);
    case 'telegram':
      return `${first.toLowerCase()}${last.toLowerCase()}${i % 100}`;
    case 'messenger':
      return `${first.toLowerCase()}.${last.toLowerCase()}.${i}`;
    case 'instagram':
      return `@${first.toLowerCase()}_${last.toLowerCase()}${i % 1000}`;
  }
}

function randomDate(daysAgo: number): Date {
  return new Date(Date.now() - randN(daysAgo * 24 * 60 * 60 * 1000));
}

async function seedLeads() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rows: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    for (let i = 0; i < 1000; i++) {
      const first = rand(FIRST_NAMES);
      const last = rand(LAST_NAMES);
      const channel = rand(CHANNELS);
      const contactValue = generateContactValue(channel, first, last, i);
      const name = `${first} ${last}`;
      const status = weightedStatus();
      const segment = weightedSegment();
      const source = rand(SOURCES);
      const isVip = Math.random() < 0.08;
      const phone = ['whatsapp', 'sms', 'telegram'].includes(channel) ? contactValue : null;
      const email = channel === 'email' ? contactValue : (Math.random() < 0.3 ? generateEmail(first, last) : null);
      const tags = Math.random() < 0.6
        ? [...new Set([rand(TAG_POOL), rand(TAG_POOL)])].slice(0, 1 + randN(3))
        : [];
      const createdAt = randomDate(180);
      const lastContactedAt = status !== 'new' ? randomDate(30) : null;
      const responseCount = status === 'new' ? 1 : 1 + randN(15);

      rows.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(
        NIL_TENANT, channel, contactValue, name, source, status, segment,
        isVip, phone, email, tags, responseCount, createdAt, lastContactedAt
      );
    }

    await client.query(
      `INSERT INTO leads
         (tenant_id, channel, contact_value, name, source, status, segment,
          is_vip, phone, email, tags, response_count, created_at, last_contacted_at)
       VALUES ${rows.join(', ')}
       ON CONFLICT (tenant_id, channel, contact_value) DO NOTHING`,
      params
    );

    await client.query('COMMIT');
    console.log(`Seeded 1000 leads (duplicates skipped by ON CONFLICT)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedLeads();
