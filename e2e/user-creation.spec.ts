import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'password123';

test.describe('Admin - User management', () => {
  test('admin can create a new user via UI', async ({ page }) => {
    // login
    await page.goto('/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');

    // navigate to users page
    await page.goto('/admin/users');
    await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible();

    // open create dialog
    await page.click('button:has-text("Add User")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const ts = Date.now();
    const email = `playwright+${ts}@test.local`;
    const name = `Playwright User ${ts}`;

    // attempt to fill by label first, fallback to inputs in dialog
    if (await page.getByLabel('Name').count()) {
      await page.fill('input[name="name"], input[placeholder="Name"]', name);
    } else {
      const inputs = page.locator('[role="dialog"] input');
      await inputs.nth(0).fill(name);
    }

    if (await page.getByLabel('Email').count()) {
      await page.fill('input[name="email"], input[type="email"]', email);
    } else {
      const inputs = page.locator('[role="dialog"] input');
      await inputs.nth(1).fill(email);
    }

    // password
    await page.fill('[role="dialog"] input[type="password"]', 'password123');

    // submit
    await page.click('[role="dialog"] button:has-text("Create User")');

    // verify user shows up in the list (allow some time for backend)
    await page.waitForTimeout(1500);
    await page.reload();
    await page.waitForTimeout(1000);

    const userRow = await page.locator(`text=${email}`).first();
    await expect(userRow).toBeVisible();
  });
});
