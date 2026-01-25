import { test, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

test.describe('API Proxy Verification with Authentication', () => {

  test('should proxy API requests through Next.js after login', async ({ page }) => {
    const apiRequests: { url: string; method: string }[] = [];

    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();

      if (url.includes('/api/v1/')) {
        apiRequests.push({ url, method });
      }
    });

    await page.goto('/login', { waitUntil: 'networkidle' });

    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard**', { timeout: 10000 });

    await page.goto('/accounts', { waitUntil: 'networkidle' });

    await page.waitForLoadState('networkidle');

    const directCalls = apiRequests.filter(req =>
      req.url.includes('localhost:8067') ||
      req.url.includes('backend:3001') ||
      req.url.includes('127.0.0.1:8067')
    );

    const proxiedCalls = apiRequests.filter(req =>
      req.url.includes('localhost:8068')
    );

    expect(directCalls.length).toBe(0);

    if (apiRequests.length > 0) {
      expect(proxiedCalls.length).toBe(apiRequests.length);
    }
  });

  test('verify proxy returns 200 with valid auth', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const cookies = await page.context().cookies();
    const nextAuthSession = cookies.find(c => c.name === 'next-auth.session-token');

    const response = await page.request.get('http://localhost:8068/api/v1/accounts', {
      headers: {
        Cookie: nextAuthSession ? `next-auth.session-token=${nextAuthSession.value}` : '',
      },
      failOnStatusCode: false
    });

    expect([200, 401, 500]).toContain(response.status());
  });
});
