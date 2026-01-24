/**
 * Playwright E2E test for single currency auto-balance flow
 * Feature: 004-journal-auto-balance
 */

import { test, expect } from '@playwright/test';

test.describe('Auto-Balance - Single Currency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/journal');
  });

  test('should auto-balance a simple 2-line entry', async ({ page }) => {
    // Click "New Entry" button
    await page.getByRole('button', { name: 'New Entry' }).click();

    // Fill first line with account and amount
    await page.locator('form').locator('select').first().click();
    await page.getByRole('option', { name: /Assets:Cash/ }).click();
    await page.locator('input[placeholder="Amount"]').first().fill('1000');

    // Leave second line empty (amount = 0)

    // Click Auto-Balance button
    await page.getByRole('button', { name: 'Auto-Balance' }).click();

    // Verify second line amount is filled with -1000
    const secondAmountInput = page.locator('input[placeholder="Amount"]').nth(1);
    await expect(secondAmountInput).toHaveValue(/-1000/);

    // Verify entry is balanced
    await expect(page.getByText('✓ Balanced')).toBeVisible();
  });

  test('should auto-balance a 3-line entry with zero amount line', async ({ page }) => {
    await page.getByRole('button', { name: 'New Entry' }).click();

    // Fill first two lines
    await page.locator('form').locator('select').first().click();
    await page.getByRole('option', { name: /Assets:Cash/ }).click();
    await page.locator('input[placeholder="Amount"]').first().fill('1000');

    await page.locator('form').locator('select').nth(1).click();
    await page.getByRole('option', { name: /Revenue:Sales/ }).click();
    await page.locator('input[placeholder="Amount"]').nth(1).fill('1000');

    // Third line has amount 0 (empty)
    await page.locator('form').locator('select').nth(2).click();
    await page.getByRole('option', { name: /Equity:Other/ }).click();

    // Click Auto-Balance
    await page.getByRole('button', { name: 'Auto-Balance' }).click();

    // Verify third line filled with -2000
    const thirdAmountInput = page.locator('input[placeholder="Amount"]').nth(2);
    await expect(thirdAmountInput).toHaveValue(/-2000/);

    // Verify balanced
    await expect(page.getByText('✓ Balanced')).toBeVisible();
  });

  test('should not show Auto-Balance button when entry is already balanced', async ({ page }) => {
    await page.getByRole('button', { name: 'New Entry' }).click();

    // Fill both lines with balancing amounts
    await page.locator('form').locator('select').first().click();
    await page.getByRole('option', { name: /Assets:Cash/ }).click();
    await page.locator('input[placeholder="Amount"]').first().fill('1000');

    await page.locator('form').locator('select').nth(1).click();
    await page.getByRole('option', { name: /Revenue:Sales/ }).click();
    await page.locator('input[placeholder="Amount"]').nth(1).fill('-1000');

    // Button should not be visible
    await expect(page.getByRole('button', { name: 'Auto-Balance' })).not.toBeVisible();
  });

  test('should not show Auto-Balance button with multiple empty lines', async ({ page }) => {
    await page.getByRole('button', { name: 'New Entry' }).click();

    // Fill first line
    await page.locator('form').locator('select').first().click();
    await page.getByRole('option', { name: /Assets:Cash/ }).click();
    await page.locator('input[placeholder="Amount"]').first().fill('1000');

    // Leave second and third lines empty
    await page.locator('form').locator('select').nth(1).click();
    await page.getByRole('option', { name: /Revenue:Sales/ }).click();
    await page.locator('form').locator('select').nth(2).click();
    await page.getByRole('option', { name: /Expenses:Other/ }).click();

    // Button should not be visible (2 empty lines)
    await expect(page.getByRole('button', { name: 'Auto-Balance' })).not.toBeVisible();
  });

  test('should show error when clicking Auto-Balance with single line', async ({ page }) => {
    await page.getByRole('button', { name: 'New Entry' }).click();

    // Add one line only (click Add Line once to have 2, then remove one)
    await page.getByRole('button', { name: 'Add Line' }).click();
    await page.locator('form').locator('select').first().click();
    await page.getByRole('option', { name: /Assets:Cash/ }).click();

    // Remove the second line to have only one
    await page.locator('button[type="button"].size-icon').last().click();

    // Try to find Auto-Balance button - should not exist
    await expect(page.getByRole('button', { name: 'Auto-Balance' })).not.toBeVisible();
  });
});
