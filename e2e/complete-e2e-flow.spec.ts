import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

test.describe('Complete E2E Flow with JWT Authentication', () => {
  test('should login and verify dashboard pages', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    expect(page.url()).toContain('/dashboard');

    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

    await page.click('a[href="/accounts"]');
    await page.waitForURL('**/accounts');
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();

    await page.click('a[href="/journal"]');
    await page.waitForURL('**/journal');
    await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();

    await page.click('a[href="/reports"]');
    await page.waitForURL('**/reports');
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();

    await page.click('a[href="/settings"]');
    await page.waitForURL('**/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  });
});

test.describe('Page Functionality Verification', () => {
  test('should allow navigation and interaction', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.click('a[href="/reports"]');
    await page.waitForURL('**/reports');

    await page.getByRole('button', { name: 'Income Statement' }).click();
    await expect(page.getByRole('button', { name: 'Income Statement' })).toBeVisible();

    await page.getByRole('button', { name: 'Refresh' }).click();

    await page.click('a[href="/settings"]');
    await page.waitForURL('**/settings');

    await page.getByRole('button', { name: 'Currencies', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Currency Management' })).toBeVisible();
  });
});
