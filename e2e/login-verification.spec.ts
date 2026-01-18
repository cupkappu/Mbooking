import { test, expect } from '@playwright/test';

test.describe('Login Verification', () => {
  const VALID_EMAIL = 'admin@example.com';
  const VALID_PASSWORD = 'password';
  const INVALID_EMAIL = 'invalid@example.com';
  const INVALID_PASSWORD = 'wrongpassword';

  test('should reject invalid credentials', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    
    await page.fill('input[type="email"]', INVALID_EMAIL);
    await page.fill('input[type="password"]', INVALID_PASSWORD);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for potential error
    await page.waitForTimeout(2000);
    
    // Should NOT navigate to dashboard
    const currentUrl = page.url();
    console.log(`URL after invalid login: ${currentUrl}`);
    console.log(`Console errors: ${consoleErrors.join(', ')}`);
    
    // If we're still on login page or error shown, credentials were rejected
    if (!currentUrl.includes('/dashboard')) {
      console.log('✅ Invalid credentials correctly rejected');
    } else {
      console.log('❌ Should not have logged in with invalid credentials');
      throw new Error('Logged in with invalid credentials!');
    }
  });

  test('should accept valid credentials', async ({ page }) => {
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    
    await page.fill('input[type="email"]', VALID_EMAIL);
    await page.fill('input[type="password"]', VALID_PASSWORD);
    
    // Submit and wait for navigation
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    
    console.log('✅ Successfully logged in with valid credentials');
    
    expect(page.url()).toContain('/dashboard');
  });
});
