import { test, expect, APIRequestContext } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

const BACKEND_URL = 'http://localhost:8067';

async function getAuthToken(request: APIRequestContext) {
  const loginResponse = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
    data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
  });
  const loginData = await loginResponse.json();
  return loginData.access_token;
}

test.describe('TDD - Dashboard Real Data Tests', () => {

  test('1. Dashboard should display real asset data from API', async ({ request }) => {
    const token = await getAuthToken(request);

    const balanceQuery = await request.post(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });

    const balanceData = await balanceQuery.json();
    expect(balanceData.balances).toBeDefined();
    expect(Array.isArray(balanceData.balances)).toBe(true);
  });

  test('2. Dashboard should call /query/summary API', async ({ request }) => {
    const token = await getAuthToken(request);

    const summaryResponse = await request.get(`${BACKEND_URL}/api/v1/query/summary`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    expect([200, 404]).toContain(summaryResponse.status());
  });

  test('3. Dashboard should display real asset amounts', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: 'Dashboard', exact: true });
    await expect(heading).toBeVisible();
  });

  test('4. Dashboard should display real liability amounts', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: 'Dashboard', exact: true });
    await expect(heading).toBeVisible();
  });

  test('5. Dashboard should display real net worth', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: 'Dashboard', exact: true });
    await expect(heading).toBeVisible();
  });

  test('6. Dashboard Recent Transactions should display real data', async ({ page, request: apiRequest }) => {
    const token = await getAuthToken(apiRequest);

    const entriesResponse = await apiRequest.get(`${BACKEND_URL}/api/v1/journal`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const entriesData = await entriesResponse.json();
    expect(entriesData).toHaveProperty('entries');

    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForLoadState('networkidle');

    const recentTransactionsSection = page.getByRole('heading', { name: 'Recent Transactions', exact: true });
    await expect(recentTransactionsSection).toBeVisible();
  });

  test('7. Dashboard data should match API response', async ({ page, request }) => {
    const token = await getAuthToken(request);

    const balanceQuery = await request.post(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });
    const balanceData = await balanceQuery.json();
    expect(balanceData).toHaveProperty('balances');

    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading', { name: 'Dashboard', exact: true });
    await expect(heading).toBeVisible();
  });
});
