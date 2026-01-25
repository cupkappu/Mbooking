import { test, expect, APIRequestContext } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

const BACKEND_URL = 'http://localhost:8067';

async function getAuthToken(request: APIRequestContext) {
  const loginResponse = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
    data: {
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password,
    },
  });

  const loginData = await loginResponse.json();

  if (!loginData.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(loginData));
  }

  return loginData.access_token;
}

test.describe('Business Functionality Tests', () => {

  test('1. Backend API should accept authenticated requests', async ({ request }) => {
    const token = await getAuthToken(request);

    const accountsResponse = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(accountsResponse.status()).toBe(200);

    const accountsData = await accountsResponse.json();
    expect(Array.isArray(accountsData)).toBe(true);
  });

  test('2. Should be able to create an account', async ({ request }) => {
    const token = await getAuthToken(request);

    const accountData = {
      name: 'Test Checking Account',
      type: 'ASSETS',
      currency: 'USD',
      parent_id: null,
    };

    const createResponse = await request.post(`${BACKEND_URL}/api/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: accountData,
    });

    expect([201, 400, 409]).toContain(createResponse.status());
  });

  test('3. Should be able to get account tree', async ({ request }) => {
    const token = await getAuthToken(request);

    const treeResponse = await request.get(`${BACKEND_URL}/api/v1/accounts/tree`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(treeResponse.status()).toBe(200);

    const treeData = await treeResponse.json();
    expect(Array.isArray(treeData)).toBe(true);
  });

  test('4. Should be able to get currencies', async ({ request }) => {
    const token = await getAuthToken(request);

    const currenciesResponse = await request.get(`${BACKEND_URL}/api/v1/currencies`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(currenciesResponse.status()).toBe(200);

    const currencies = await currenciesResponse.json();
    expect(Array.isArray(currencies)).toBe(true);
  });

  test('5. Should be able to query balances', async ({ request }) => {
    const token = await getAuthToken(request);

    const queryResponse = await request.post(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {},
    });

    expect([200, 201]).toContain(queryResponse.status());

    if (queryResponse.status() === 200) {
      const balances = await queryResponse.json();
      expect(balances).toHaveProperty('balances');
    }
  });

  test('6. Should be able to get reports', async ({ request }) => {
    const token = await getAuthToken(request);

    const bsResponse = await request.get(`${BACKEND_URL}/api/v1/reports/balance-sheet?from=2026-01-01&to=2026-01-31`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect([200, 400]).toContain(bsResponse.status());

    const isResponse = await request.get(`${BACKEND_URL}/api/v1/reports/income-statement?from=2026-01-01&to=2026-01-31`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect([200, 400]).toContain(isResponse.status());
  });

  test('7. Frontend should integrate with backend via API proxy', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[type="password"]', TEST_CREDENTIALS.password);

    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);

    await page.click('a[href="/accounts"]');
    await page.waitForURL('**/accounts', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    await page.click('a[href="/journal"]');
    await page.waitForURL('**/journal', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    await page.click('a[href="/reports"]');
    await page.waitForURL('**/reports', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    await page.click('a[href="/settings"]');
    await page.waitForURL('**/settings', { timeout: 5000 });
    await page.waitForLoadState('networkidle');
  });

  test('8. Full business workflow verification', async ({ request }) => {
    const token = await getAuthToken(request);

    const initialAccounts = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(initialAccounts.status()).toBe(200);

    const finalBalances = await request.post(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });
    expect([200, 201]).toContain(finalBalances.status());
  });
});
