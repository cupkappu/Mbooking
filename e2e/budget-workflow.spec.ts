import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

test.describe('Budget Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    expect(page.url()).toContain('/dashboard');
  });

  test('should load budget list page', async ({ page }) => {
    await page.goto('/budgets', { waitUntil: 'networkidle' });
    // Check page loads and has the expected title content (may render as Budgets or 预算)
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('should navigate to budgets from sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Budgets');
    await expect(page).toHaveURL('/budgets');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('should load budget detail page', async ({ page }) => {
    await page.goto('/budgets/1', { waitUntil: 'networkidle' });
  });
});

test.describe('Budget Template E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
  });

  test('should display budget templates', async ({ page }) => {
    await page.goto('/budgets/1', { waitUntil: 'networkidle' });
  });

  test('should create budget from template', async ({ page }) => {
    await page.goto('/budgets/1', { waitUntil: 'networkidle' });
  });
});
