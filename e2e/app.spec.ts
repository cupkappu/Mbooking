import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

async function login(page: any) {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
  await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
  await Promise.all([
    page.waitForURL('**/dashboard**', { timeout: 10000 }),
    page.click('button[type="submit"]'),
  ]);
}

test.describe('Login Page', () => {
  test('should load the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Welcome Back', { exact: true })).toBeVisible();
    await expect(page.getByText('Sign in to your account', { exact: true })).toBeVisible();
  });

  test('should display email and password inputs', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should display sign in button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  });

  test('should display Google sign in button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  });
});

test.describe('Homepage Redirect', () => {
  test('should redirect to dashboard from root', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.reload();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Dashboard', () => {
  test('should display dashboard page', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByText('Welcome to your accounting dashboard')).toBeVisible();
  });

  test('should display summary cards', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await expect(page.getByText('Total Assets', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Liabilities', { exact: true })).toBeVisible();
    await expect(page.getByText('Net Worth', { exact: true })).toBeVisible();
  });

  test('should display recent transactions section', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Recent Transactions', exact: true })).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate to accounts page', async ({ page }) => {
    await login(page);
    await page.goto('/accounts', { waitUntil: 'networkidle' });
    // Wait for accounts to load (API may take time)
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true }), {
      timeout: 30000  // 30 seconds for API response
    }).toBeVisible();
  });

  test('should navigate to journal page', async ({ page }) => {
    await login(page);
    await page.goto('/journal', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Journal', exact: true }), {
      timeout: 30000
    }).toBeVisible();
  });

  test('should navigate to reports page', async ({ page }) => {
    await login(page);
    await page.goto('/reports', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Reports', exact: true }), {
      timeout: 30000
    }).toBeVisible();
    await expect(page.getByRole('button', { name: 'Balance Sheet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Income Statement' })).toBeVisible();
  });

  test('should navigate to settings page', async ({ page }) => {
    await login(page);
    await page.goto('/settings', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Settings', exact: true }), {
      timeout: 30000
    }).toBeVisible();
  });
});

test.describe('Reports Page', () => {
  test('should toggle between balance sheet and income statement', async ({ page }) => {
    await login(page);
    await page.goto('/reports');

    await expect(page.getByRole('button', { name: 'Balance Sheet' })).toBeVisible();

    await page.getByRole('button', { name: 'Income Statement' }).click();

    await expect(page.getByRole('button', { name: 'Income Statement' })).toBeVisible();
  });

  test('should have date range inputs', async ({ page }) => {
    await login(page);
    await page.goto('/reports');
    const fromInput = page.locator('label:has-text("From")').locator('..').locator('input[type="date"]');
    const toInput = page.locator('label:has-text("To")').locator('..').locator('input[type="date"]');

    await expect(fromInput).toBeVisible();
    await expect(toInput).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});

test.describe('Settings Page', () => {
  test('should display settings tabs', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'General', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Currencies', exact: true })).toBeVisible();
  });

  test('should toggle between tabs', async ({ page }) => {
    await login(page);
    await page.goto('/settings');

    await page.getByRole('button', { name: 'Currencies', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Currency Management' })).toBeVisible();

    await page.getByRole('button', { name: 'General', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'General Settings' })).toBeVisible();
  });
});
