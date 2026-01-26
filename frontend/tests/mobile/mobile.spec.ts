import { test, expect } from '@playwright/test';
import { loginAsUser } from '../utils/auth';

test.describe('Mobile Responsiveness', () => {
  test.use({
    viewport: { width: 375, height: 667 }, // iPhone SE dimensions
  });

  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('should display mobile navigation menu', async ({ page }) => {
    // On mobile, navigation should be a hamburger menu
    const menuButton = page.locator('[data-testid="mobile-menu"]');

    // Menu button should be visible on mobile
    await expect(menuButton).toBeVisible();
  });

  test('should open mobile navigation drawer when clicking menu', async ({ page }) => {
    // Click the mobile menu button
    await page.click('[data-testid="mobile-menu"]');

    // Sheet/Drawer should be visible
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Navigation links should be present
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Journal')).toBeVisible();
  });

  test('should navigate using mobile drawer', async ({ page }) => {
    // Open the mobile menu
    await page.click('[data-testid="mobile-menu"]');

    // Click on Journal link in drawer
    await page.click('text=Journal');

    // Should navigate to journal page
    await expect(page.locator('h1')).toContainText('Journal');
  });

  test('should close drawer after navigation', async ({ page }) => {
    // Open the mobile menu
    await page.click('[data-testid="mobile-menu"]');

    // Drawer should be open
    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Navigate to a page
    await page.click('text=Settings');

    // Drawer should be closed
    await expect(drawer).not.toBeVisible();
  });

  test('should be able to navigate to journal on mobile', async ({ page }) => {
    // Navigate to journal page
    await page.goto('/journal');
    await page.waitForLoadState('networkidle');

    // Page title should be visible
    await expect(page.locator('h1')).toContainText('Journal');
  });

  test('should be able to navigate to settings on mobile', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page should load
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should display currencies table responsively on mobile', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Currencies');
    await page.waitForLoadState('networkidle');

    // Table or card view should be visible
    const hasContent = await page.locator('table, .currency-card').first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('should handle form inputs on mobile', async ({ page }) => {
    await page.goto('/journal');
    await page.click('text=New Entry');

    // Form should be usable on mobile
    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeVisible();

    // Form fields should be large enough for touch
    const box = await dateInput.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(40); // Touch-friendly size
  });

  test('journal entry form should be scrollable on mobile', async ({ page }) => {
    await page.goto('/journal');
    await page.click('text=New Entry');

    // The form container should be scrollable
    const formContainer = page.locator('.journal-form, form').first();
    await expect(formContainer).toBeVisible();

    // Verify scroll is enabled
    const isScrollable = await formContainer.evaluate(el => {
      return el.scrollHeight > el.clientHeight;
    });

    expect(isScrollable).toBeTruthy();
  });
});

test.describe('Admin Panel Mobile Navigation', () => {
  test.use({
    viewport: { width: 375, height: 667 }, // iPhone SE dimensions
  });

  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/admin');
  });

  test('should display admin mobile menu button', async ({ page }) => {
    const menuButton = page.locator('[data-testid="admin-mobile-menu"]');
    await expect(menuButton).toBeVisible();
  });

  test('should open admin navigation drawer', async ({ page }) => {
    await page.click('[data-testid="admin-mobile-menu"]');

    const drawer = page.locator('[role="dialog"]');
    await expect(drawer).toBeVisible();

    // Admin nav items should be present
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator('text=Currencies')).toBeVisible();
  });

  test('should navigate admin pages using mobile drawer', async ({ page }) => {
    await page.click('[data-testid="admin-mobile-menu"]');

    // Click on Users link
    await page.click('text=Users');

    // Should navigate to users page
    await expect(page.locator('h1, h2')).toContainText(/Users|User/);
  });
});

test.describe('Mobile - Different Devices', () => {
  test('should work on iPhone 12', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsUser(page);
    await page.goto('/journal');
    await expect(page.locator('h1')).toContainText('Journal');
  });

  test('should work on Android (Pixel 5)', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await loginAsUser(page);
    await page.goto('/journal');
    await expect(page.locator('h1')).toContainText('Journal');
  });

  test('should work on iPad Mini', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAsUser(page);
    await page.goto('/journal');
    await expect(page.locator('h1')).toContainText('Journal');
  });
});
