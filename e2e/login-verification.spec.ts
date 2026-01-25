import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

test.describe('Login Verification', () => {
  const INVALID_EMAIL = 'invalid@example.com';
  const INVALID_PASSWORD = 'wrongpassword';

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });

    await page.fill('input[type="email"]', INVALID_EMAIL);
    await page.fill('input[type="password"]', INVALID_PASSWORD);

    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    expect(page.url()).not.toContain('/dashboard');
  });

  test('should accept valid credentials', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });

    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    expect(page.url()).toContain('/dashboard');
  });
});
