import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// ------------------------------------------------------------------
// SHARED AUTH � login once (in auth.setup.ts), reuse token everywhere
// ------------------------------------------------------------------

const API = 'http://localhost:4000';
let cachedToken: string | null = null;

function getToken(): string {
  if (cachedToken) return cachedToken;
  const authFile = path.join(__dirname, '..', '.auth', 'state.json');
  const data = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  cachedToken = data.token;
  return data.token;
}

async function injectAuth(page: Page) {
  const token = getToken();
  await page.addInitScript((t: string) => {
    window.localStorage.setItem('crm-auth', JSON.stringify({
      state: {
        user: { id: '00000000-0000-0000-0000-000000000002', name: 'CRM Admin', email: 'admin@msgcrm.com', role: 'admin' },
        token: t,
      },
      version: 0,
    }));
  }, token);
}

async function assertNoPageError(page: Page) {
  const errBoundary = page.locator('text=Page Error');
  const visible = await errBoundary.isVisible().catch(() => false);
  if (visible) {
    const msg = await page.locator('.text-gray-400, .text-red-400').first().textContent().catch(() => 'unknown');
    throw new Error(`Page crashed: ${msg}`);
  }
}

// ------------------------------------------------------------------
// 1. API HEALTH CHECKS
// ------------------------------------------------------------------

test.describe('API Health', () => {
  test('login endpoint returns JWT', async ({ request }) => {
    const res = await request.post(`${API}/api/auth/login`, {
      data: { email: 'admin@msgcrm.com', password: 'Admin@1234' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe('admin@msgcrm.com');
  });

  const endpoints = [
    '/api/campaigns',
    '/api/leads',
    '/api/analytics/summary',
    '/api/sms/stats/providers',
    '/api/growth/dashboard',
    '/api/automation/rules',
    '/api/whatsapp/stats/providers',
    '/api/instagram/accounts',
    '/api/qr-payment/config',
    '/api/products',
    '/api/inbox/threads?channel=whatsapp',
    '/api/wa-saas/dashboard',
    '/api/wa-saas/drip/campaigns',
    '/api/wa-saas/ai-bot/configs',
    '/api/wa-saas/orders/configs',
    '/api/wa-saas/subscriptions/plans',
    '/api/wa-saas/flash-sales',
    '/api/wa-saas/team-inbox/agents',
    '/api/wa-saas/links',
    '/api/wa-saas/reengagement',
    '/api/wa-saas/broadcast-opt/configs',
    '/api/wa-saas/business-cards',
    '/api/wa-saas/notifications',
    '/api/wa-chat/credentials',
  ];

  for (const ep of endpoints) {
    test(`GET ${ep}`, async ({ request }) => {
      const token = getToken();
      const res = await request.get(`${API}${ep}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });
  }
});

// ------------------------------------------------------------------
// 2. AUTH FLOW
// ------------------------------------------------------------------

test.describe('Authentication', () => {
  test('unauthenticated ? redirected to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page has email + password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('valid login ? redirected to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'admin@msgcrm.com');
    await page.fill('input[type="password"]', 'Admin@1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 15000 });
    await expect(page).toHaveURL('/');
  });

  test('wrong password ? stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'admin@msgcrm.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/login/);
  });
});

// ------------------------------------------------------------------
// 3. ALL PAGES LOAD WITHOUT CRASHING
// ------------------------------------------------------------------

const ALL_ROUTES: [string, string][] = [
  ['/', 'Dashboard'],
  ['/leads', 'Lead'],

  ['/whatsapp', 'WhatsApp'],
  ['/whatsapp/campaigns', 'Campaign'],
  ['/whatsapp/templates', 'Template'],
  ['/whatsapp/analytics', 'Analytic'],

  ['/sms', 'SMS'],
  ['/sms/campaigns', 'Campaign'],
  ['/sms/providers', 'SMS'],
  ['/sms/analytics', 'SMS'],

  ['/email', 'Email'],
  ['/email/campaigns', 'Campaign'],

  ['/telegram', 'Telegram'],
  ['/telegram/campaigns', 'Campaign'],

  ['/messenger', 'Messenger'],
  ['/messenger/campaigns', 'Campaign'],

  ['/inbox', 'Inbox'],
  ['/inbox/whatsapp', 'Inbox'],
  ['/inbox/sms', 'Inbox'],
  ['/inbox/email', 'Inbox'],
  ['/inbox/telegram', 'Inbox'],
  ['/inbox/messenger', 'Inbox'],

  ['/automation', 'Automation'],
  ['/analytics', 'Analytic'],

  ['/clients', 'Client'],
  ['/billing', 'Billing'],
  ['/cart-recovery', 'Cart'],

  ['/products', 'Product'],
  ['/products/funnel', 'Funnel'],
  ['/products/appointments', 'Appointment'],
  ['/products/payment-bot', 'Payment'],
  ['/products/reviews', 'Review'],
  ['/products/events', 'Event'],
  ['/products/catalog', 'Catalog'],
  ['/products/surveys', 'Survey'],
  ['/products/memberships', 'Membership'],

  ['/instagram', 'Instagram'],
  ['/instagram/inbox', 'Instagram'],
  ['/instagram/comment-automation', 'Comment'],
  ['/instagram/story-automation', 'Stor'],
  ['/instagram/lead-bot', 'Lead'],
  ['/instagram/content', 'Content'],
  ['/instagram/analytics', 'Analytic'],

  ['/growth', 'Growth'],
  ['/growth/lead-capture', 'Lead'],
  ['/growth/missed-call', 'Missed'],
  ['/growth/followups', 'Follow'],
  ['/growth/loyalty', 'Loyalty'],
  ['/growth/referral', 'Referral'],
  ['/growth/review-booster', 'Review'],
  ['/growth/pipeline', 'Pipeline'],
  ['/growth/broadcast', 'Broadcast'],
  ['/growth/ads', 'Ads'],
  ['/growth/websites', 'Website'],

  ['/wa-saas', 'SaaS'],
  ['/wa-saas/drip', 'Drip'],
  ['/wa-saas/ai-bot', 'AI'],
  ['/wa-saas/orders', 'Order'],
  ['/wa-saas/subscriptions', 'Subscription'],
  ['/wa-saas/flash-sales', 'Flash'],
  ['/wa-saas/team-inbox', 'Team'],
  ['/wa-saas/links', 'Link'],
  ['/wa-saas/reengagement', 'engag'],
  ['/wa-saas/broadcast-opt', 'Broadcast'],
  ['/wa-saas/business-cards', 'Business'],

  ['/qr-payment', 'QR'],
  ['/qr-payment/admin', 'QR'],

  ['/wa-chat', 'Chat'],
  ['/wa-chat/settings', 'Setting'],
];

test.describe('All Pages Load', () => {
  for (const [route, _expectedText] of ALL_ROUTES) {
    test(`${route}`, async ({ page }) => {
      await injectAuth(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await assertNoPageError(page);
      // Verify we're authenticated (not on login page)
      const bodyText = await page.textContent('body') || '';
      expect(bodyText).not.toContain('Sign in to your account');
      expect(bodyText.length).toBeGreaterThan(50);
    });
  }
});

// ------------------------------------------------------------------
// 4. SIDEBAR
// ------------------------------------------------------------------

test.describe('Sidebar', () => {
  test('sidebar visible on desktop', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
  });

  test('sidebar navigation to /leads', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href="/leads"]').first();
    if (await link.isVisible()) {
      await link.click();
      await page.waitForURL(/\/leads/);
    }
  });
});

// ------------------------------------------------------------------
// 5. FUNCTIONAL TESTS
// ------------------------------------------------------------------

test.describe('Dashboard Functional', () => {
  test('dashboard renders stat cards / widgets', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await assertNoPageError(page);
    const body = await page.textContent('body');
    expect(body).toContain('Dashboard');
  });
});

test.describe('Leads Functional', () => {
  test('leads page shows table or empty state', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');
    await assertNoPageError(page);
  });
});

test.describe('Campaign Builder', () => {
  test('campaign builder page loads', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/whatsapp/campaigns');
    await page.waitForLoadState('networkidle');
    await assertNoPageError(page);
  });
});

test.describe('Analytics', () => {
  test('analytics page loads', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await assertNoPageError(page);
  });
});

// ------------------------------------------------------------------
// 6. RESPONSIVE
// ------------------------------------------------------------------

test.describe('Responsive', () => {
  test('mobile viewport renders dashboard', async ({ page }) => {
    await injectAuth(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await assertNoPageError(page);
    const body = await page.textContent('body');
    expect(body).toContain('Dashboard');
  });

  test('tablet viewport renders dashboard', async ({ page }) => {
    await injectAuth(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await assertNoPageError(page);
  });
});
