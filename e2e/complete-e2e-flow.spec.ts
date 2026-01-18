import { test, expect } from '@playwright/test';

const VALID_EMAIL = 'admin@example.com';
const VALID_PASSWORD = 'password';

test.describe('Complete E2E Flow with JWT Authentication', () => {
  test('should login and verify all dashboard pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Login
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', VALID_EMAIL);
    await page.fill('input[type="password"]', VALID_PASSWORD);
    
    // Submit and wait for navigation to dashboard
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    
    console.log('✅ Successfully logged in with valid credentials');
    expect(page.url()).toContain('/dashboard');

    // 2. Verify Dashboard
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByText('Total Assets', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Liabilities', { exact: true })).toBeVisible();
    await expect(page.getByText('Net Worth', { exact: true })).toBeVisible();
    console.log('✅ Dashboard verified');

    // 3. Navigate to Accounts
    await page.click('a[href="/accounts"]');
    await page.waitForURL('**/accounts');
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Account' })).toBeVisible();
    console.log('✅ Accounts page verified');

    // 4. Navigate to Journal
    await page.click('a[href="/journal"]');
    await page.waitForURL('**/journal');
    await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Entry' })).toBeVisible();
    console.log('✅ Journal page verified');

    // 5. Navigate to Reports
    await page.click('a[href="/reports"]');
    await page.waitForURL('**/reports');
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Balance Sheet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Income Statement' })).toBeVisible();
    
    // Verify date inputs
    const fromInput = page.locator('label:has-text("From")').locator('..').locator('input[type="date"]');
    const toInput = page.locator('label:has-text("To")').locator('..').locator('input[type="date"]');
    await expect(fromInput).toBeVisible();
    await expect(toInput).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    console.log('✅ Reports page verified');

    // 6. Navigate to Settings
    await page.click('a[href="/settings"]');
    await page.waitForURL('**/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'General', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Currencies', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rate Providers', exact: true })).toBeVisible();
    console.log('✅ Settings page verified');

    // Check console errors
    if (consoleErrors.length > 0) {
      console.log(`⚠️ Console errors detected: ${consoleErrors.length}`);
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    } else {
      console.log('✅ No console errors detected');
    }

    console.log('🎉 All E2E tests passed successfully!');
  });
});

test.describe('Page Functionality Verification', () => {
  test('should allow navigation and interaction', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', VALID_EMAIL);
    await page.fill('input[type="password"]', VALID_PASSWORD);
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    // Test reports page interactions
    await page.click('a[href="/reports"]');
    await page.waitForURL('**/reports');
    
    // Click Income Statement button
    await page.getByRole('button', { name: 'Income Statement' }).click();
    await expect(page.getByRole('button', { name: 'Income Statement' })).toBeVisible();
    
    // Click Refresh button
    await page.getByRole('button', { name: 'Refresh' }).click();
    console.log('✅ Reports page interactions verified');

    // Test settings page tabs
    await page.click('a[href="/settings"]');
    await page.waitForURL('**/settings');
    
    // Switch to Currencies tab
    await page.getByRole('button', { name: 'Currencies', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Currency Management' })).toBeVisible();
    
    // Switch to Rate Providers tab
    await page.getByRole('button', { name: 'Rate Providers', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Rate Providers' })).toBeVisible();
    
    console.log('✅ Settings page interactions verified');
    console.log('🎉 All functionality tests passed!');
  });
});
