# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-validation-simple.spec.ts >> Simple UI Validation >> Theme toggle functionality
- Location: e2e\ui-validation-simple.spec.ts:50:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button[title*="Switch to"]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('button[title*="Switch to"]')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "MsgCRM" [level=1] [ref=e9]
    - paragraph [ref=e10]: Sign in to your account
  - generic [ref=e11]:
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Email address
        - generic [ref=e15]:
          - img [ref=e16]
          - textbox "you@example.com" [ref=e19]
      - generic [ref=e20]:
        - generic [ref=e21]: Password
        - generic [ref=e22]:
          - img [ref=e23]
          - textbox "••••••••" [ref=e26]
          - button [ref=e27] [cursor=pointer]:
            - img [ref=e28]
      - button "Sign in" [ref=e31] [cursor=pointer]
    - paragraph [ref=e32]:
      - text: Don't have an account?
      - link "Create one" [ref=e33] [cursor=pointer]:
        - /url: /register
  - paragraph [ref=e34]: "Default login: admin@msgcrm.com / Admin@1234"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import fs from 'fs';
  3   | import path from 'path';
  4   | 
  5   | const AUTH_FILE = path.join(__dirname, '..', '.auth', 'state.json');
  6   | 
  7   | test.describe('Simple UI Validation', () => {
  8   |   test('Application loads and basic UI elements are present', async ({ page }) => {
  9   |     // Set longer timeout for this test
  10  |     test.setTimeout(60000);
  11  |     
  12  |     try {
  13  |       // Load auth state if available
  14  |       if (fs.existsSync(AUTH_FILE)) {
  15  |         const { token } = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  16  |         await page.goto('/');
  17  |         await page.evaluate((token) => {
  18  |           localStorage.setItem('crm-auth-token', token);
  19  |         }, token);
  20  |         await page.reload();
  21  |       } else {
  22  |         // Manual login
  23  |         await page.goto('/login');
  24  |         await page.fill('input[type="email"]', 'admin@msgcrm.com');
  25  |         await page.fill('input[type="password"]', 'Admin@1234');
  26  |         await page.click('button[type="submit"]');
  27  |         await page.waitForURL('/', { timeout: 30000 });
  28  |       }
  29  | 
  30  |       // Wait for page to load
  31  |       await page.waitForLoadState('networkidle');
  32  |       
  33  |       // Take screenshot of the loaded page
  34  |       await page.screenshot({ path: 'test-results/app-loaded.png', fullPage: true });
  35  |       
  36  |       // Basic checks
  37  |       await expect(page.locator('aside')).toBeVisible(); // Sidebar
  38  |       await expect(page.locator('header')).toBeVisible(); // Topbar
  39  |       await expect(page.locator('main')).toBeVisible(); // Main content
  40  |       
  41  |       console.log('✅ Application loaded successfully');
  42  |       
  43  |     } catch (error) {
  44  |       console.error('❌ Test failed:', error);
  45  |       await page.screenshot({ path: 'test-results/error-screenshot.png', fullPage: true });
  46  |       throw error;
  47  |     }
  48  |   });
  49  | 
  50  |   test('Theme toggle functionality', async ({ page }) => {
  51  |     test.setTimeout(60000);
  52  |     
  53  |     await page.goto('/');
  54  |     await page.waitForLoadState('networkidle');
  55  |     
  56  |     // Find theme toggle button
  57  |     const themeButton = page.locator('button[title*="Switch to"]');
> 58  |     await expect(themeButton).toBeVisible();
      |                               ^ Error: expect(locator).toBeVisible() failed
  59  |     
  60  |     // Get initial theme
  61  |     const initialTheme = await page.evaluate(() => 
  62  |       document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  63  |     );
  64  |     
  65  |     console.log(`Initial theme: ${initialTheme}`);
  66  |     
  67  |     // Take screenshot of initial theme
  68  |     await page.screenshot({ path: `test-results/theme-initial-${initialTheme}.png` });
  69  |     
  70  |     // Click theme toggle
  71  |     await themeButton.click();
  72  |     await page.waitForTimeout(1000);
  73  |     
  74  |     // Get new theme
  75  |     const newTheme = await page.evaluate(() => 
  76  |       document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  77  |     );
  78  |     
  79  |     console.log(`New theme: ${newTheme}`);
  80  |     
  81  |     // Take screenshot of new theme
  82  |     await page.screenshot({ path: `test-results/theme-toggled-${newTheme}.png` });
  83  |     
  84  |     // Verify theme changed
  85  |     expect(newTheme).not.toBe(initialTheme);
  86  |     
  87  |     console.log('✅ Theme toggle works correctly');
  88  |   });
  89  | 
  90  |   test('Sidebar locked modules', async ({ page }) => {
  91  |     test.setTimeout(60000);
  92  |     
  93  |     await page.goto('/');
  94  |     await page.waitForLoadState('networkidle');
  95  |     
  96  |     // Take screenshot of sidebar
  97  |     await page.screenshot({ path: 'test-results/sidebar-modules.png' });
  98  |     
  99  |     // Check for WA Chat (should be active)
  100 |     const waChatLink = page.locator('nav a[href="/wa-chat"]');
  101 |     await expect(waChatLink).toBeVisible();
  102 |     console.log('✅ WA Chat link is visible and active');
  103 |     
  104 |     // Check for locked modules (should be buttons, not links)
  105 |     const lockedModules = ['WhatsApp', 'Inbox', 'Automation', 'Products'];
  106 |     
  107 |     for (const moduleName of lockedModules) {
  108 |       const moduleButton = page.locator(`nav button:has-text("${moduleName}")`);
  109 |       if (await moduleButton.isVisible()) {
  110 |         console.log(`✅ ${moduleName} is locked (button, not link)`);
  111 |         
  112 |         // Try clicking to see if toast appears
  113 |         await moduleButton.click();
  114 |         await page.waitForTimeout(1000);
  115 |         
  116 |         // Check for toast or error message
  117 |         const hasToast = await page.locator('text=Coming Soon, text=In Development, text=Feature Locked').isVisible();
  118 |         if (hasToast) {
  119 |           console.log(`✅ ${moduleName} shows lock message when clicked`);
  120 |         }
  121 |       }
  122 |     }
  123 |     
  124 |     console.log('✅ Locked modules validation completed');
  125 |   });
  126 | 
  127 |   test('No WA SaaS duplicate in sidebar', async ({ page }) => {
  128 |     test.setTimeout(60000);
  129 |     
  130 |     await page.goto('/');
  131 |     await page.waitForLoadState('networkidle');
  132 |     
  133 |     // Check that WA SaaS is not present
  134 |     const waSaasLink = page.locator('nav a[href="/wa-saas"]');
  135 |     const waSaasButton = page.locator('nav button:has-text("WA SaaS")');
  136 |     
  137 |     await expect(waSaasLink).not.toBeVisible();
  138 |     await expect(waSaasButton).not.toBeVisible();
  139 |     
  140 |     console.log('✅ WA SaaS duplicate successfully removed');
  141 |   });
  142 | 
  143 |   test('Dashboard content validation', async ({ page }) => {
  144 |     test.setTimeout(60000);
  145 |     
  146 |     await page.goto('/');
  147 |     await page.waitForLoadState('networkidle');
  148 |     
  149 |     // Take screenshot of dashboard
  150 |     await page.screenshot({ path: 'test-results/dashboard-content.png', fullPage: true });
  151 |     
  152 |     // Check for dashboard elements
  153 |     const hasLeads = await page.locator('text=Total Leads, text=Leads').isVisible();
  154 |     const hasMessages = await page.locator('text=Messages, text=Sent').isVisible();
  155 |     const hasActivity = await page.locator('text=Activity, text=Channel').isVisible();
  156 |     
  157 |     if (hasLeads) console.log('✅ Leads section found');
  158 |     if (hasMessages) console.log('✅ Messages section found');
```