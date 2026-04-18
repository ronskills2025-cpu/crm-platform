import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '..', '.auth', 'state.json');

setup('authenticate', async ({ request }) => {
  // Login via API
  const res = await request.post('http://localhost:4000/api/auth/login', {
    data: { email: 'admin@msgcrm.com', password: 'Admin@1234' },
  });

  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }

  const { token } = await res.json();

  // Ensure .auth directory exists
  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Save token for other tests
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ token }));
});
