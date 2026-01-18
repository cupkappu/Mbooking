import { test, expect } from '@playwright/test';

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
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Dashboard', () => {
  test('should display dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByText('Welcome to your accounting dashboard')).toBeVisible();
  });

  test('should display summary cards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Total Assets', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Liabilities', { exact: true })).toBeVisible();
    await expect(page.getByText('Net Worth', { exact: true })).toBeVisible();
  });

  test('should display recent transactions section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Recent Transactions', exact: true })).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate to accounts page', async ({ page }) => {
    await page.goto('/accounts');
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
  });

  test('should navigate to journal page', async ({ page }) => {
    await page.goto('/journal');
    await expect(page.getByRole('heading', { name: 'Journal', exact: true })).toBeVisible();
  });

  test('should navigate to reports page', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Balance Sheet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Income Statement' })).toBeVisible();
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  });
});

test.describe('Reports Page', () => {
  test('should toggle between balance sheet and income statement', async ({ page }) => {
    await page.goto('/reports');

    // Check Balance Sheet button exists
    await expect(page.getByRole('button', { name: 'Balance Sheet' })).toBeVisible();

    // Click on Income Statement
    await page.getByRole('button', { name: 'Income Statement' }).click();

    // Check Income Statement button is now active (visible)
    await expect(page.getByRole('button', { name: 'Income Statement' })).toBeVisible();
  });

  test('should have date range inputs', async ({ page }) => {
    await page.goto('/reports');
    // Find label by text, then get sibling input
    const fromInput = page.locator('label:has-text("From")').locator('..').locator('input[type="date"]');
    const toInput = page.locator('label:has-text("To")').locator('..').locator('input[type="date"]');
    
    await expect(fromInput).toBeVisible();
    await expect(toInput).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});

test.describe('Settings Page', () => {
  test('should display settings tabs', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'General', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Currencies', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rate Providers', exact: true })).toBeVisible();
  });

  test('should toggle between tabs', async ({ page }) => {
    await page.goto('/settings');

    // Click on Currencies tab
    await page.getByRole('button', { name: 'Currencies', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Currency Management' })).toBeVisible();

    // Click on Rate Providers tab
    await page.getByRole('button', { name: 'Rate Providers', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Rate Providers' })).toBeVisible();
  });
});
