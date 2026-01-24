/**
 * Playwright E2E test for multi-currency auto-balance flow
 * Feature: 004-journal-auto-balance
 */

import { test, expect } from '@playwright/test';

test.describe('Auto-Balance - Multi-Currency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/journal');
  });

  test('should auto-balance multi-currency entry', async ({ page }) => {
    await page.getByRole('button', { name: 'New Entry' }).click();

    // Fill USD line
    await page.locator('form').locator('select').first().click();
    await page.getByRole('option', { name: /Assets:Cash.*USD/ }).click();
    await page.locator('input[placeholder="Amount"]').first().fill('1000');
    await page.locator('select').nth(1).selectOption('USD');

    // Leave second USD line empty
    await page.locator('form').locator('select').nth(2).click();
    await page.getByRole('option', { name: /Liabilities:Credit/ }).click();
    await page.locator('input[placeholder="Amount"]').nth(1).fill('');
    await page.locator('select').nth(3).selectOption('USD');

    // Add CNY line
    await page.getByRole('button', { name: 'Add Line' }).click();
    await page.locator('form').locator('select').nth(4).click();
    await page.getByRole('option', { name: /Expenses:Other.*CNY/ }).click();
    await page.locator('input[placeholder="Amount"]').nth(2).fill('-600');
    await page.locator('select').nth(5).selectOption('CNY');

    // Click Auto-Balance
    await page.getByRole('button', { name: 'Auto-Balance' }).click();

    // Verify USD line filled with -1000
    await expect(page.locator('input[placeholder="Amount"]').nth(1)).toHaveValue(/-1000/);

    // Verify new CNY line created with +600
    const cnyInputs = page.locator('input[placeholder="Amount"]');
    await expect(cnyInputs.nth(2)).toHaveValue(/-600/);
    await expect(cnyInputs.nth(3)).toHaveValue(/600/);

    // Verify entry is balanced
    await expect(page.getByText('✓ Balanced')).toBeVisible();
  });

  test('should create one new line per additional currency', async ({ page }) => {
    await page.getByRole('button', { name: 'New Entry' }).click();

    // USD line (empty)
    await page.locator('form').locator('select').first().click();
    await page.getByRole('option', { name: /Assets:Cash.*USD/ }).click();
    await page.locator('input[placeholder="Amount"]').first().fill('');

    // CNY line
    await page.getByRole('button', { name: 'Add Line' }).click();
    await page.locator('form').locator('select').nth(2).click();
    await page.getByRole('option', { name: /Revenue:Sales.*CNY/ }).click();
    await page.locator('input[placeholder="Amount"]').nth(1).fill('-500');

    // EUR line
    await page.getByRole('button', { name: 'Add Line' }).click();
    await page.locator('form').locator('select').nth(4).click();
    await page.getByRole('option', { name: /Expenses:Other.*EUR/ }).click();
    await page.locator('input[placeholder="Amount"]').nth(2).fill('-300');

    // Click Auto-Balance
    await page.getByRole('button', { name: 'Auto-Balance' }).click();

    // Verify USD line filled (+800 since CNY-500 + EUR-300 = -800)
    await expect(page.locator('input[placeholder="Amount"]').first()).toHaveValue(/800/);

    // Verify new lines created for CNY and EUR
    const allAmountInputs = page.locator('input[placeholder="Amount"]');
    expect(allAmountInputs).toHaveCount(5); // 3 original + 2 new

    // Verify each currency balances
    await expect(page.getByText('✓ Balanced')).toBeVisible();
  });

  test('should show error when currencies cannot balance', async ({ page }) => {
    await page.getByRole('button', { name: 'New Entry' }).click();

    // USD line (empty)
    await page.locator('form').locator('select').first().click();
    await page.getByRole('option', { name: /Assets:Cash.*USD/ }).click();
    await page.locator('input[placeholder="Amount"]').first().fill('');

    // CNY line with amount that won't allow balance
    await page.getByRole('button', { name: 'Add Line' }).click();
    await page.locator('form').locator('select').nth(2).click();
    await page.getByRole('option', { name: /Revenue:Sales.*CNY/ }).click();
    await page.locator('input[placeholder="Amount"]').nth(1).fill('-100');

    // Click Auto-Balance
    await page.getByRole('button', { name: 'Auto-Balance' }).click();

    // Should show error (no exchange rate available)
    await expect(page.getByText(/error|balance/i)).toBeVisible();
  });

  test('should preserve original line accounts when creating new currency lines', async ({ page }) => {
    await page.getByRole('button', { name: 'New Entry' }).click();

    // Empty line with specific account
    await page.locator('form').locator('select').first().click();
    await page.getByRole('option', { name: /Assets:Bank/ }).click();
    await page.locator('input[placeholder="Amount"]').first().fill('');

    // CNY line with different account
    await page.getByRole('button', { name: 'Add Line' }).click();
    await page.locator('form').locator('select').nth(2).click();
    await page.getByRole('option', { name: /Revenue:Sales.*CNY/ }).click();
    await page.locator('input[placeholder="Amount"]').nth(1).fill('-200');

    // Click Auto-Balance
    await page.getByRole('button', { name: 'Auto-Balance' }).click();

    // New CNY line should use the same account as the empty line (Assets:Bank)
    const cnySelect = page.locator('form').locator('select').nth(4);
    await expect(cnySelect).toHaveValue(/bank/i);
  });
});
