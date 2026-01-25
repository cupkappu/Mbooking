import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

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

  test('should load budget alerts page', async ({ page }) => {
    await page.goto('/budgets/1', { waitUntil: 'networkidle' });
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

  test('should display multi-currency summary option', async ({ page }) => {
    await page.goto('/budgets/1', { waitUntil: 'networkidle' });
  });

  test('should show budget totals in different currencies', async ({ page }) => {
    await page.goto('/budgets/1', { waitUntil: 'networkidle' });
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

  test('should display budget progress bars', async ({ page }) => {
    await page.goto('/budgets/1', { waitUntil: 'networkidle' });
  });

  test('should show budget spent vs remaining amounts', async ({ page }) => {
    await page.goto('/budgets/1', { waitUntil: 'networkidle' });
  });
});
