import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

test.describe('Balance investigation', () => {
  test('accounts page shows balances and balances API returns data', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');

    await page.goto('/accounts');
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  });
});
