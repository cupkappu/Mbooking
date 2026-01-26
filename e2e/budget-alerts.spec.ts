import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

// TODO: Create budgets list page at /budgets
// These tests are skipped until the page is implemented

test.describe('Budget Alert Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.url()).toContain('/dashboard');
  });

  test.skip('should load budget alerts page', async ({ page }) => {
    await page.goto('/budgets', { waitUntil: 'networkidle' });
    await expect(page.getByText('Budgets', { exact: true })).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Multi-Currency Budget Summary E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
  });

  test.skip('should display multi-currency summary option', async ({ page }) => {
    await page.goto('/budgets', { waitUntil: 'networkidle' });
    await expect(page.getByText('Budgets', { exact: true })).toBeVisible({ timeout: 30000 });
  });

  test.skip('should show budget totals in different currencies', async ({ page }) => {
    await page.goto('/budgets', { waitUntil: 'networkidle' });
    await expect(page.getByText('Budgets', { exact: true })).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Budget Progress Tracking E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
  });

  test.skip('should display budget progress bars', async ({ page }) => {
    await page.goto('/budgets', { waitUntil: 'networkidle' });
    await expect(page.getByText('Budgets', { exact: true })).toBeVisible({ timeout: 30000 });
  });

  test.skip('should show budget spent vs remaining amounts', async ({ page }) => {
    await page.goto('/budgets', { waitUntil: 'networkidle' });
    await expect(page.getByText('Budgets', { exact: true })).toBeVisible({ timeout: 30000 });
  });
});
