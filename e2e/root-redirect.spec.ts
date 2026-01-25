import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

test.describe('Root Path Redirect', () => {
  test('should redirect to login when not logged in', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(login|setup)/);
  });

  test('should redirect to dashboard when logged in', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });

    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/dashboard');
  });
});
