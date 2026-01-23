import { test, expect } from '@playwright/test';

test.describe('Root Path Redirect', () => {
  test('should redirect to setup when system is not initialized', async ({ page }) => {
    await page.goto('http://localhost:8068/');
    // Wait for redirect to setup (landing page checks status and redirects)
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Wait for API check
    const currentUrl = page.url();
    // Should redirect to setup when not initialized
    expect(currentUrl).toContain('/setup');
  });

  test('should redirect to login when system is initialized but user not logged in', async ({ page }) => {
    // First initialize the system
    await page.goto('http://localhost:8068/setup');
    await page.waitForLoadState('networkidle');
    
    // Fill in setup form - use evaluate for controlled input
    await page.locator('#initSecret').fill('init_secret');
    await page.fill('#email', 'admin@test.com');
    await page.fill('#name', 'Test Admin');
    await page.fill('#password', 'AdminTest123');
    
    // Submit and wait for dashboard
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
    
    // Now logout by clearing storage
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Go to root - should redirect to login
    await page.goto('http://localhost:8068/');
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should stay on landing page when logged in', async ({ page }) => {
    // Initialize system first
    await page.goto('http://localhost:8068/setup');
    await page.waitForLoadState('networkidle');
    
    await page.locator('#initSecret').fill('init_secret');
    await page.fill('#email', 'admin@test.com');
    await page.fill('#name', 'Test Admin');
    await page.fill('#password', 'AdminTest123');
    
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
    
    // Now go to root - should stay on landing page (with login state)
    await page.goto('http://localhost:8068/');
    await page.waitForTimeout(2000);
    const url = page.url();
    // Should stay on root path (showing landing page with user info)
    expect(url).toMatch(/localhost:8068\/?$/);
  });
});
