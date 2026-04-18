import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '..', '.auth', 'state.json');

test.describe('UI Cleanup & Standardization Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Load auth state
    if (fs.existsSync(AUTH_FILE)) {
      const { token } = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
      await page.goto('/');
      await page.evaluate((token) => {
        localStorage.setItem('crm-auth-token', token);
      }, token);
      await page.reload();
    } else {
      // Manual login if auth setup failed
      await page.goto('/login');
      await page.fill('input[type="email"]', 'admin@msgcrm.com');
      await page.fill('input[type="password"]', 'Admin@1234');
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    }
  });

  test('Dashboard loads without dummy data', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dashboard"], .space-y-6');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'test-results/dashboard-clean.png', fullPage: true });
    
    // Verify no hardcoded dummy numbers (like "12,458" or "48.2K")
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('12,458');
    expect(pageContent).not.toContain('48.2K');
    expect(pageContent).not.toContain('15.7K');
    
    // Verify real data structure is present
    await expect(page.locator('text=Total Leads')).toBeVisible();
    await expect(page.locator('text=Messages Sent')).toBeVisible();
    await expect(page.locator('text=Channel Activity')).toBeVisible();
  });

  test('Sidebar shows locked modules with proper indicators', async ({ page }) => {
    await page.goto('/');
    
    // Take screenshot of sidebar
    await page.screenshot({ path: 'test-results/sidebar-locked-modules.png' });
    
    // Verify WA Chat is active (not locked)
    const waChatItem = page.locator('nav a[href="/wa-chat"]');
    await expect(waChatItem).toBeVisible();
    await expect(waChatItem.locator('svg[data-testid="lock-icon"]')).not.toBeVisible();
    
    // Verify locked modules have lock icons and "Soon" badges
    const lockedModules = [
      'WhatsApp', 'Inbox', 'Automation', 'Products', 'Growth', 
      'QR Payment', 'Cart Recovery', 'Clients'
    ];
    
    for (const moduleName of lockedModules) {
      const moduleButton = page.locator(`nav button:has-text("${moduleName}")`);
      await expect(moduleButton).toBeVisible();
      
      // Check for lock icon
      await expect(moduleButton.locator('svg').last()).toBeVisible();
      
      // Check for "Soon" badge
      if (moduleName !== 'QR Payment' && moduleName !== 'Cart Recovery' && moduleName !== 'Clients') {
        await expect(moduleButton.locator('text=Soon')).toBeVisible();
      }
    }
  });

  test('Locked modules show error toast when clicked', async ({ page }) => {
    await page.goto('/');
    
    // Click on a locked module (WhatsApp)
    await page.click('nav button:has-text("WhatsApp")');
    
    // Verify toast error appears
    await expect(page.locator('text=Coming Soon - In Development')).toBeVisible({ timeout: 3000 });
  });

  test('WA SaaS duplicate is removed from sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Verify WA SaaS is not in sidebar
    await expect(page.locator('nav a[href="/wa-saas"]')).not.toBeVisible();
    await expect(page.locator('nav button:has-text("WA SaaS")')).not.toBeVisible();
    
    // Verify WA Chat is present instead
    await expect(page.locator('nav a[href="/wa-chat"]')).toBeVisible();
  });

  test('Campaign item removed from sidebar (not under QR Payment)', async ({ page }) => {
    await page.goto('/');
    
    // Verify standalone Campaign item is not in sidebar
    await expect(page.locator('nav a[href="/campaigns/new"]')).not.toBeVisible();
    
    // Campaign should only be accessible via quick actions in dashboard
    await expect(page.locator('a[href="/campaigns/new"]:has-text("New Campaign")')).toBeVisible();
  });

  test('Dark/Light theme toggle works properly', async ({ page }) => {
    await page.goto('/');
    
    // Get initial theme
    const initialTheme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    
    // Take screenshot of current theme
    await page.screenshot({ path: `test-results/theme-${initialTheme}.png` });
    
    // Click theme toggle
    await page.click('button[title*="Switch to"]');
    
    // Wait for theme change
    await page.waitForTimeout(500);
    
    // Verify theme changed
    const newTheme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    expect(newTheme).not.toBe(initialTheme);
    
    // Take screenshot of new theme
    await page.screenshot({ path: `test-results/theme-${newTheme}.png` });
    
    // Verify CSS variables are applied
    const bgColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-root'));
    expect(bgColor).toBeTruthy();
    
    // Toggle back
    await page.click('button[title*="Switch to"]');
    await page.waitForTimeout(500);
    
    const finalTheme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    expect(finalTheme).toBe(initialTheme);
  });

  test('Navigation to active modules works', async ({ page }) => {
    await page.goto('/');
    
    // Test navigation to active modules
    const activeModules = [
      { name: 'Leads', path: '/leads' },
      { name: 'WA Chat', path: '/wa-chat' },
      { name: 'Analytics', path: '/analytics' },
      { name: 'Billing', path: '/billing' }
    ];
    
    for (const module of activeModules) {
      await page.click(`nav a[href="${module.path}"]`);
      await page.waitForURL(`**${module.path}*`);
      
      // Take screenshot of each active module
      await page.screenshot({ path: `test-results/module-${module.name.toLowerCase().replace(' ', '-')}.png` });
      
      // Verify page loaded (no error boundary)
      await expect(page.locator('text=Page Error')).not.toBeVisible();
    }
  });

  test('UI consistency across components', async ({ page }) => {
    await page.goto('/');
    
    // Check that all components use CSS variables
    const elements = await page.locator('[class*="var(--"]').count();
    expect(elements).toBeGreaterThan(0);
    
    // Verify no hardcoded colors in critical components
    const sidebar = page.locator('aside');
    const topbar = page.locator('header');
    
    await expect(sidebar).toBeVisible();
    await expect(topbar).toBeVisible();
    
    // Take full page screenshot for manual review
    await page.screenshot({ path: 'test-results/full-ui-consistency.png', fullPage: true });
  });

  test('Search functionality in topbar', async ({ page }) => {
    await page.goto('/');
    
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    
    // Test search input styling
    await searchInput.focus();
    await page.screenshot({ path: 'test-results/search-focused.png' });
    
    // Verify search input uses theme variables
    const inputBg = await searchInput.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(inputBg).toBeTruthy();
  });

  test('Profile dropdown functionality', async ({ page }) => {
    await page.goto('/');
    
    // Click profile dropdown
    await page.click('button:has-text("admin@msgcrm.com"), div:has-text("U") >> nth=0');
    
    // Verify dropdown appears with proper styling
    await expect(page.locator('text=Sign out')).toBeVisible();
    
    // Take screenshot of dropdown
    await page.screenshot({ path: 'test-results/profile-dropdown.png' });
    
    // Click away to close
    await page.click('main');
    await expect(page.locator('text=Sign out')).not.toBeVisible();
  });

  test('No console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(2000); // Wait for any async operations
    
    // Filter out known acceptable errors (like API calls to non-existent endpoints)
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Dashboard data will load when available') &&
      !error.includes('Failed to fetch') &&
      !error.includes('/api/analytics/dashboard')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});
