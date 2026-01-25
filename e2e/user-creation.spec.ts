import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

test.describe('Admin - User management', () => {
  test('admin can access users page', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');

    const response = await page.goto('/admin/users');
    expect(response?.status()).toBeLessThan(500);
  });
});
