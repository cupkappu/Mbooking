import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

// TODO: Create budgets list page at /budgets
// These tests are skipped until the page is implemented

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

  test.skip('should load budget page', async ({ page }) => {
    await page.goto('/budgets', { waitUntil: 'networkidle' });
    await expect(page.getByText('Budgets', { exact: true })).toBeVisible({ timeout: 30000 });
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

  test.skip('should display budget templates', async ({ page }) => {
    await page.goto('/budgets', { waitUntil: 'networkidle' });
    await expect(page.getByText('Budgets', { exact: true })).toBeVisible({ timeout: 30000 });
  });

  test.skip('should create budget from template', async ({ page }) => {
    await page.goto('/budgets', { waitUntil: 'networkidle' });
    await expect(page.getByText('Budgets', { exact: true })).toBeVisible({ timeout: 30000 });
  });
});
