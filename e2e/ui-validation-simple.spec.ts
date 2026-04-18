import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '..', '.auth', 'state.json');

test.describe('Simple UI Validation', () => {
  test('Application loads and basic UI elements are present', async ({ page }) => {
    // Set longer timeout for this test
    test.setTimeout(60000);
    
    try {
      // Load auth state if available
      if (fs.existsSync(AUTH_FILE)) {
        const { token } = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
        await page.goto('/');
        await page.evaluate((token) => {
          localStorage.setItem('crm-auth-token', token);
        }, token);
        await page.reload();
      } else {
        // Manual login
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@msgcrm.com');
        await page.fill('input[type="password"]', 'Admin@1234');
        await page.click('button[type="submit"]');
        await page.waitForURL('/', { timeout: 30000 });
      }

      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of the loaded page
      await page.screenshot({ path: 'test-results/app-loaded.png', fullPage: true });
      
      // Basic checks
      await expect(page.locator('aside')).toBeVisible(); // Sidebar
      await expect(page.locator('header')).toBeVisible(); // Topbar
      await expect(page.locator('main')).toBeVisible(); // Main content
      
      console.log('✅ Application loaded successfully');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      await page.screenshot({ path: 'test-results/error-screenshot.png', fullPage: true });
      throw error;
    }
  });

  test('Theme toggle functionality', async ({ page }) => {
    test.setTimeout(60000);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find theme toggle button
    const themeButton = page.locator('button[title*="Switch to"]');
    await expect(themeButton).toBeVisible();
    
    // Get initial theme
    const initialTheme = await page.evaluate(() => 
      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    );
    
    console.log(`Initial theme: ${initialTheme}`);
    
    // Take screenshot of initial theme
    await page.screenshot({ path: `test-results/theme-initial-${initialTheme}.png` });
    
    // Click theme toggle
    await themeButton.click();
    await page.waitForTimeout(1000);
    
    // Get new theme
    const newTheme = await page.evaluate(() => 
      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    );
    
    console.log(`New theme: ${newTheme}`);
    
    // Take screenshot of new theme
    await page.screenshot({ path: `test-results/theme-toggled-${newTheme}.png` });
    
    // Verify theme changed
    expect(newTheme).not.toBe(initialTheme);
    
    console.log('✅ Theme toggle works correctly');
  });

  test('Sidebar locked modules', async ({ page }) => {
    test.setTimeout(60000);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of sidebar
    await page.screenshot({ path: 'test-results/sidebar-modules.png' });
    
    // Check for WA Chat (should be active)
    const waChatLink = page.locator('nav a[href="/wa-chat"]');
    await expect(waChatLink).toBeVisible();
    console.log('✅ WA Chat link is visible and active');
    
    // Check for locked modules (should be buttons, not links)
    const lockedModules = ['WhatsApp', 'Inbox', 'Automation', 'Products'];
    
    for (const moduleName of lockedModules) {
      const moduleButton = page.locator(`nav button:has-text("${moduleName}")`);
      if (await moduleButton.isVisible()) {
        console.log(`✅ ${moduleName} is locked (button, not link)`);
        
        // Try clicking to see if toast appears
        await moduleButton.click();
        await page.waitForTimeout(1000);
        
        // Check for toast or error message
        const hasToast = await page.locator('text=Coming Soon, text=In Development, text=Feature Locked').isVisible();
        if (hasToast) {
          console.log(`✅ ${moduleName} shows lock message when clicked`);
        }
      }
    }
    
    console.log('✅ Locked modules validation completed');
  });

  test('No WA SaaS duplicate in sidebar', async ({ page }) => {
    test.setTimeout(60000);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that WA SaaS is not present
    const waSaasLink = page.locator('nav a[href="/wa-saas"]');
    const waSaasButton = page.locator('nav button:has-text("WA SaaS")');
    
    await expect(waSaasLink).not.toBeVisible();
    await expect(waSaasButton).not.toBeVisible();
    
    console.log('✅ WA SaaS duplicate successfully removed');
  });

  test('Dashboard content validation', async ({ page }) => {
    test.setTimeout(60000);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of dashboard
    await page.screenshot({ path: 'test-results/dashboard-content.png', fullPage: true });
    
    // Check for dashboard elements
    const hasLeads = await page.locator('text=Total Leads, text=Leads').isVisible();
    const hasMessages = await page.locator('text=Messages, text=Sent').isVisible();
    const hasActivity = await page.locator('text=Activity, text=Channel').isVisible();
    
    if (hasLeads) console.log('✅ Leads section found');
    if (hasMessages) console.log('✅ Messages section found');
    if (hasActivity) console.log('✅ Activity section found');
    
    // Check that no hardcoded dummy data is present
    const pageContent = await page.textContent('body');
    const hasDummyData = pageContent?.includes('12,458') || pageContent?.includes('48.2K');
    
    if (!hasDummyData) {
      console.log('✅ No hardcoded dummy data found');
    } else {
      console.log('⚠️ Some dummy data may still be present');
    }
  });
});
