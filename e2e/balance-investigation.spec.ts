import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'password123';

test.describe('Balance investigation', () => {
  test('accounts page shows balances and balances API returns data', async ({ page }) => {
    // login
    await page.goto('/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');

    // navigate to accounts page
    await page.goto('/accounts');
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();

    // check that some balance-like text exists on the page
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/\d[\d,]*\.\d{2}/);

    // query balances endpoint via client-side fetch (uses current session)
    const balances = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/v1/query/balances');
        if (!res.ok) return { ok: false, status: res.status };
        return { ok: true, json: await res.json() };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });

    expect(balances.ok).toBeTruthy();
    expect(balances.json).toBeDefined();

    // If api returns an object with balances array, ensure it's an array
    if (Array.isArray(balances.json?.balances)) {
      expect(balances.json.balances.length).toBeGreaterThanOrEqual(0);
    }
  });
});
