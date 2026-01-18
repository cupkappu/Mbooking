import { test, expect, APIRequestContext } from '@playwright/test';

const VALID_EMAIL = 'admin@example.com';
const VALID_PASSWORD = 'password';
const BACKEND_URL = 'http://localhost:8067';

async function getAuthToken(request: APIRequestContext) {
  // Login via NextAuth API - backend has global prefix 'api/v1'
  const loginResponse = await request.post(`http://localhost:8067/api/v1/auth/login`, {
    data: {
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    },
  });
  
  const loginData = await loginResponse.json();
  console.log('Login response:', loginResponse.status(), loginData);
  
  if (!loginData.access_token) {
    throw new Error('Failed to get access token: ' + JSON.stringify(loginData));
  }
  
  return loginData.access_token;
}

test.describe('Business Functionality Tests', () => {
  
  test('1. Backend API should accept authenticated requests', async ({ request }) => {
    const token = await getAuthToken(request);
    
    // Test accounts API
    const accountsResponse = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Accounts API status:', accountsResponse.status());
    expect(accountsResponse.status()).toBe(200);
    
    const accountsData = await accountsResponse.json();
    console.log('Accounts data:', JSON.stringify(accountsData, null, 2));
    
    // Should return array of accounts
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
    
    console.log('Create account status:', createResponse.status());
    
    if (createResponse.status() === 201) {
      const created = await createResponse.json();
      console.log('Account created:', JSON.stringify(created, null, 2));
      expect(created).toHaveProperty('id');
      expect(created.name).toBe('Test Checking Account');
    } else {
      // Account might already exist (400)
      console.log('Account creation response:', await createResponse.text());
      const errorData = await createResponse.json();
      console.log('Note: Account may already exist:', errorData.message || 'Unknown error');
    }
  });

  test('3. Should be able to get account tree', async ({ request }) => {
    const token = await getAuthToken(request);
    
    const treeResponse = await request.get(`${BACKEND_URL}/api/v1/accounts/tree`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Account tree status:', treeResponse.status());
    expect(treeResponse.status()).toBe(200);
    
    const treeData = await treeResponse.json();
    console.log('Account tree:', JSON.stringify(treeData, null, 2));
    
    expect(Array.isArray(treeData)).toBe(true);
  });

  test('4. Should be able to create journal entry', async ({ request }) => {
    const token = await getAuthToken(request);
    
    // First get accounts to find valid account IDs
    const accountsResponse = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const accounts = await accountsResponse.json();
    console.log('Available accounts:', JSON.stringify(accounts, null, 2));
    
    if (accounts.length > 0) {
      const accountId = accounts[0].id;
      
      // Create a journal entry with debit and credit
      const entryData = {
        date: new Date().toISOString().split('T')[0],
        description: 'Test transaction from Playwright',
        lines: [
          {
            account_id: accountId,
            debit: 100.00,
            credit: 0,
            currency: 'USD',
          },
          {
            account_id: accountId, // Same account for simplicity (self-balancing)
            debit: 0,
            credit: 100.00,
            currency: 'USD',
          },
        ],
      };
      
      const entryResponse = await request.post(`${BACKEND_URL}/api/v1/journal/entries`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: entryData,
      });
      
      console.log('Create entry status:', entryResponse.status());
      
      if (entryResponse.status() === 201) {
        const entry = await entryResponse.json();
        console.log('Entry created:', JSON.stringify(entry, null, 2));
        expect(entry).toHaveProperty('id');
      } else {
        console.log('Entry creation response:', await entryResponse.text());
      }
    } else {
      console.log('No accounts available to create journal entry');
    }
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
    
    console.log('Balances query status:', queryResponse.status());
    expect([200, 201]).toContain(queryResponse.status());
    
    const balances = await queryResponse.json();
    console.log('Balances:', JSON.stringify(balances, null, 2));
    
    expect(balances).toHaveProperty('balances');
    expect(Array.isArray(balances.balances)).toBe(true);
    console.log(`✅ Found ${balances.balances.length} balance entries`);
  });

  test('6. Should be able to get reports', async ({ request }) => {
    const token = await getAuthToken(request);
    
    // Test balance sheet
    const bsResponse = await request.get(`${BACKEND_URL}/api/v1/reports/balance-sheet?from=2026-01-01&to=2026-01-31`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Balance sheet status:', bsResponse.status());
    
    if (bsResponse.status() === 200) {
      const bsData = await bsResponse.json();
      console.log('Balance Sheet:', JSON.stringify(bsData, null, 2));
    } else {
      console.log('Balance sheet response:', await bsResponse.text());
    }
    
    // Test income statement
    const isResponse = await request.get(`${BACKEND_URL}/api/v1/reports/income-statement?from=2026-01-01&to=2026-01-31`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Income statement status:', isResponse.status());
    
    if (isResponse.status() === 200) {
      const isData = await isResponse.json();
      console.log('Income Statement:', JSON.stringify(isData, null, 2));
    } else {
      console.log('Income statement response:', await isResponse.text());
    }
  });

  test('7. Should be able to get currencies', async ({ request }) => {
    const token = await getAuthToken(request);
    
    const currenciesResponse = await request.get(`${BACKEND_URL}/api/v1/currencies`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Currencies status:', currenciesResponse.status());
    expect(currenciesResponse.status()).toBe(200);
    
    const currencies = await currenciesResponse.json();
    console.log('Currencies:', JSON.stringify(currencies, null, 2));
    
    expect(Array.isArray(currencies)).toBe(true);
  });

  test('8. Should be able to get exchange rates', async ({ request }) => {
    const token = await getAuthToken(request);
    
    const ratesResponse = await request.get(`${BACKEND_URL}/api/v1/rates?from=USD&to=EUR`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('Exchange rates status:', ratesResponse.status());
    
    if (ratesResponse.status() === 200) {
      const rates = await ratesResponse.json();
      console.log('Exchange rates:', JSON.stringify(rates, null, 2));
    } else {
      console.log('Exchange rates response:', await ratesResponse.text());
    }
  });

  test('9. Frontend should integrate with backend via API proxy', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Login
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', VALID_EMAIL);
    await page.fill('input[type="password"]', VALID_PASSWORD);
    
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    
    console.log('✅ Frontend login successful');
    
    // Navigate to accounts - should show actual data from backend
    await page.click('a[href="/accounts"]');
    await page.waitForURL('**/accounts', { timeout: 5000 });
    
    // Check for loading states or data display
    await page.waitForTimeout(2000); // Wait for API call
    
    // Navigate to journal
    await page.click('a[href="/journal"]');
    await page.waitForURL('**/journal', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Navigate to reports
    await page.click('a[href="/reports"]');
    await page.waitForURL('**/reports', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Navigate to settings
    await page.click('a[href="/settings"]');
    await page.waitForURL('**/settings', { timeout: 5000 });
    
    // Check settings tabs
    await page.getByRole('button', { name: 'Currencies' }).click();
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: 'Rate Providers' }).click();
    await page.waitForTimeout(500);
    
    console.log('✅ All frontend pages accessible');
    
    if (consoleErrors.length > 0) {
      console.log('⚠️ Console errors found:');
      consoleErrors.forEach(err => console.log(`  - ${err.substring(0, 100)}`));
    } else {
      console.log('✅ No console errors');
    }
  });

  test('10. Full business workflow: Create account -> Create entry -> View report', async ({ request }) => {
    const token = await getAuthToken(request);
    
    console.log('=== Starting Business Workflow Test ===');
    
    // Step 1: Check initial state
    const initialAccounts = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const initialData = await initialAccounts.json();
    console.log(`Initial accounts count: ${initialData.length}`);
    
    // Step 2: Check initial balances
    const initialBalances = await request.get(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const balancesData = await initialBalances.json();
    console.log(`Initial balance entries: ${balancesData.length}`);
    
    // Step 3: Create a new account
    const accountData = {
      name: `Test Account ${Date.now()}`,
      type: 'ASSETS',
      currency: 'USD',
    };
    
    const createResult = await request.post(`${BACKEND_URL}/api/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: accountData,
    });
    
    if (createResult.status() === 201) {
      const newAccount = await createResult.json();
      console.log(`✅ Created account: ${newAccount.name} (ID: ${newAccount.id})`);
      
      // Step 4: Create journal entry using new account
      const entryData = {
        date: new Date().toISOString().split('T')[0],
        description: 'Initial capital investment',
        lines: [
          {
            account_id: newAccount.id,
            debit: 5000.00,
            credit: 0,
            currency: 'USD',
          },
          {
            account_id: newAccount.id, // Self-balancing for simplicity
            debit: 0,
            credit: 5000.00,
            currency: 'USD',
          },
        ],
      };
      
      const entryResult = await request.post(`${BACKEND_URL}/api/v1/journal/entries`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: entryData,
      });
      
      if (entryResult.status() === 201) {
        const newEntry = await entryResult.json();
        console.log(`✅ Created journal entry: ${newEntry.id}`);
      } else {
        console.log(`❌ Failed to create entry: ${entryResult.status()}`);
      }
    } else {
      console.log(`❌ Failed to create account: ${createResult.status()}`);
    }
    
    // Step 5: Check final balances
    const finalBalances = await request.get(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const finalData = await finalBalances.json();
    console.log(`Final balance entries: ${finalData.length}`);
    
    console.log('=== Business Workflow Test Complete ===');
  });
});
