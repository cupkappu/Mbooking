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

test.describe('Revenue & Expense Tests', () => {

  test('1. Create revenue entry and verify income statement', async ({ request }) => {
    const token = await getAuthToken(request);

    const accountsResponse = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const accounts = await accountsResponse.json();

    const revenueAccount = accounts.find((acc: any) => acc.type === 'revenue');
    const assetAccount = accounts.find((acc: any) => acc.type === 'assets');

    if (!revenueAccount || !assetAccount) {
      test.skip();
    }

    const incomeAmount = 5000;
    const entryData = {
      date: new Date().toISOString().split('T')[0],
      description: 'Sales revenue',
      lines: [
        { account_id: assetAccount.id, amount: incomeAmount, converted_amount: incomeAmount, currency: 'USD' },
        { account_id: revenueAccount.id, amount: -incomeAmount, converted_amount: -incomeAmount, currency: 'USD' },
      ],
    };

    const entryResponse = await request.post(`${BACKEND_URL}/api/v1/journal`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: entryData,
    });

    expect(entryResponse.status()).toBe(201);

    const today = new Date().toISOString().split('T')[0];
    const isResponse = await request.get(
      `${BACKEND_URL}/api/v1/reports/income-statement?from=2026-01-01&to=${today}`,
      { headers: { 'Authorization': `Bearer ${token}` } },
    );

    expect(isResponse.status()).toBe(200);
    const isData = await isResponse.json();

    expect(Math.abs(isData.sections.revenue.total)).toBeGreaterThan(0);
  });

  test('2. Create expense entry and verify income statement', async ({ request }) => {
    const token = await getAuthToken(request);

    const accountsResponse = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const accounts = await accountsResponse.json();

    let expenseAccount = accounts.find((acc: any) => acc.type === 'expense');
    let assetAccount = accounts.find((acc: any) => acc.type === 'assets');

    if (!expenseAccount || !assetAccount) {
      test.skip();
    }

    const expenseAmount = 1500;
    const entryData = {
      date: new Date().toISOString().split('T')[0],
      description: 'Office rent',
      lines: [
        { account_id: expenseAccount.id, amount: expenseAmount, converted_amount: expenseAmount, currency: 'USD' },
        { account_id: assetAccount.id, amount: -expenseAmount, converted_amount: -expenseAmount, currency: 'USD' },
      ],
    };

    const entryResponse = await request.post(`${BACKEND_URL}/api/v1/journal`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: entryData,
    });

    expect(entryResponse.status()).toBe(201);

    const today = new Date().toISOString().split('T')[0];
    const isResponse = await request.get(
      `${BACKEND_URL}/api/v1/reports/income-statement?from=2026-01-01&to=${today}`,
      { headers: { 'Authorization': `Bearer ${token}` } },
    );

    expect(isResponse.status()).toBe(200);
    const isData = await isResponse.json();

    expect(isData.sections.expenses.total).toBeGreaterThan(0);

    const revenue = isData.totals.revenue || 0;
    const expenses = isData.totals.expenses || 0;
    const netIncome = isData.totals.net_income || 0;

    expect(netIncome).toBeCloseTo(revenue - expenses, 2);
  });

  test('3. Complete financial statement verification', async ({ request }) => {
    const token = await getAuthToken(request);

    const today = new Date().toISOString().split('T')[0];

    const bsResponse = await request.get(
      `${BACKEND_URL}/api/v1/reports/balance-sheet?from=2026-01-01&to=${today}`,
      { headers: { 'Authorization': `Bearer ${token}` } },
    );

    expect(bsResponse.status()).toBe(200);
    const bsData = await bsResponse.json();

    const assets = bsData.totals.assets || 0;
    const liabilities = bsData.totals.liabilities || 0;
    const equity = bsData.totals.equity || 0;

    expect(assets).toBeGreaterThanOrEqual(0);

    const isResponse = await request.get(
      `${BACKEND_URL}/api/v1/reports/income-statement?from=2026-01-01&to=${today}`,
      { headers: { 'Authorization': `Bearer ${token}` } },
    );

    expect(isResponse.status()).toBe(200);
    const isData = await isResponse.json();

    const revenue = isData.totals.revenue || 0;
    const expenses = isData.totals.expenses || 0;
    const netIncome = isData.totals.net_income || 0;

    expect(netIncome).toBeCloseTo(revenue - expenses, 2);
  });

  test('4. Multiple business transactions verification', async ({ request }) => {
    const token = await getAuthToken(request);

    const accountsResponse = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const accounts = await accountsResponse.json();

    const revenueAccount = accounts.find((acc: any) => acc.type === 'revenue');
    const expenseAccount = accounts.find((acc: any) => acc.type === 'expense');
    const assetAccount = accounts.find((acc: any) => acc.type === 'assets');

    if (!revenueAccount || !expenseAccount || !assetAccount) {
      test.skip();
    }

    const saleEntry = await request.post(`${BACKEND_URL}/api/v1/journal`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        date: new Date().toISOString().split('T')[0],
        description: 'Product sales',
        lines: [
          { account_id: assetAccount.id, amount: 2000, converted_amount: 2000, currency: 'USD' },
          { account_id: revenueAccount.id, amount: -2000, converted_amount: -2000, currency: 'USD' },
        ],
      },
    });
    expect(saleEntry.status()).toBe(201);

    const expenseEntry = await request.post(`${BACKEND_URL}/api/v1/journal`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        date: new Date().toISOString().split('T')[0],
        description: 'Office supplies',
        lines: [
          { account_id: expenseAccount.id, amount: 500, converted_amount: 500, currency: 'USD' },
          { account_id: assetAccount.id, amount: -500, converted_amount: -500, currency: 'USD' },
        ],
      },
    });
    expect(expenseEntry.status()).toBe(201);

    const today = new Date().toISOString().split('T')[0];
    const isResponse = await request.get(
      `${BACKEND_URL}/api/v1/reports/income-statement?from=2026-01-01&to=${today}`,
      { headers: { 'Authorization': `Bearer ${token}` } },
    );

    const isData = await isResponse.json();

    const totalRevenue = Math.abs(isData.sections.revenue.total);
    const totalExpenses = isData.sections.expenses.total;

    expect(totalRevenue).toBeGreaterThan(0);
    expect(totalExpenses).toBeGreaterThan(0);
  });
});
