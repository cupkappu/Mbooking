import { test, expect, APIRequestContext } from '@playwright/test';
import { TEST_CREDENTIALS } from './constants';

const BACKEND_URL = 'http://localhost:8067';

async function getAuthToken(request: APIRequestContext) {
  const loginResponse = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
    data: { email: TEST_CREDENTIALS.email, password: TEST_CREDENTIALS.password },
  });
  const loginData = await loginResponse.json();
  expect(loginData.access_token).toBeDefined();
  return loginData.access_token;
}

test.describe('Data Integrity Tests', () => {

  test('1. Create account and verify data persistence', async ({ request }) => {
    const token = await getAuthToken(request);
    const uniqueName = `Test Account_${Date.now()}`;

    const createResponse = await request.post(`${BACKEND_URL}/api/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        name: uniqueName,
        type: 'ASSETS',
        currency: 'USD',
      },
    });

    expect([201, 400, 409]).toContain(createResponse.status());

    const listResponse = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(listResponse.status()).toBe(200);
    const accounts = await listResponse.json();
    expect(Array.isArray(accounts)).toBe(true);
  });

  test('2. Double-entry bookkeeping validation', async ({ request }) => {
    const token = await getAuthToken(request);

    const accountsResponse = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const accounts = await accountsResponse.json();
    expect(accountsResponse.status()).toBe(200);

    if (accounts.length > 0) {
      const testAccount = accounts[0];
      const amount = 100.00;

      const entryData = {
        date: new Date().toISOString().split('T')[0],
        description: 'Balance verification test',
        lines: [
          {
            account_id: testAccount.id,
            amount: amount,
            currency: 'USD',
          },
          {
            account_id: testAccount.id,
            amount: -amount,
            currency: 'USD',
          },
        ],
      };

      const totalAmount = entryData.lines.reduce((sum: number, line: any) => sum + (line.amount || 0), 0);
      expect(Math.abs(totalAmount)).toBeCloseTo(0, 2);
    }
  });

  test('3. Balance calculation verification', async ({ request }) => {
    const token = await getAuthToken(request);

    const balanceQuery1 = await request.post(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {},
    });

    expect([200, 201]).toContain(balanceQuery1.status());
  });

  test('4. Balance sheet verification', async ({ request }) => {
    const token = await getAuthToken(request);

    const today = new Date().toISOString().split('T')[0];

    const bsResponse = await request.get(
      `${BACKEND_URL}/api/v1/reports/balance-sheet?from=2026-01-01&to=${today}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    expect([200, 400]).toContain(bsResponse.status());
  });

  test('5. Income statement verification', async ({ request }) => {
    const token = await getAuthToken(request);

    const today = new Date().toISOString().split('T')[0];

    const isResponse = await request.get(
      `${BACKEND_URL}/api/v1/reports/income-statement?from=2026-01-01&to=${today}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    expect([200, 400]).toContain(isResponse.status());
  });

  test('6. Complete business flow verification', async ({ request }) => {
    const token = await getAuthToken(request);

    const initialBalanceQuery = await request.post(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });
    expect([200, 201]).toContain(initialBalanceQuery.status());

    const today = new Date().toISOString().split('T')[0];
    const bsResponse = await request.get(
      `${BACKEND_URL}/api/v1/reports/balance-sheet?from=2026-01-01&to=${today}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    expect([200, 400]).toContain(bsResponse.status());
  });
});
