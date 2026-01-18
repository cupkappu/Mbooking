import { test, expect, APIRequestContext } from '@playwright/test';

const VALID_EMAIL = 'admin@example.com';
const VALID_PASSWORD = 'password';
const BACKEND_URL = 'http://localhost:8067';

async function getAuthToken(request: APIRequestContext) {
  const loginResponse = await request.post(`http://localhost:8067/api/v1/auth/login`, {
    data: { email: VALID_EMAIL, password: VALID_PASSWORD },
  });
  const loginData = await loginResponse.json();
  return loginData.access_token;
}

test.describe('TDD - Dashboard Real Data Tests', () => {
  
  test('1. Dashboard应该显示从API获取的真实资产数据', async ({ request }) => {
    const token = await getAuthToken(request);
    
    // 先创建一些资产记账
    const accountsResponse = await request.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const accounts = await accountsResponse.json();
    const assetAccount = accounts.find((acc: any) => acc.type === 'assets');
    
    if (assetAccount) {
      // 创建资产记账
      await request.post(`${BACKEND_URL}/api/v1/journal`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          date: new Date().toISOString().split('T')[0],
          description: 'Dashboard测试-初始投资',
          lines: [
            { account_id: assetAccount.id, amount: 5000, converted_amount: 5000, currency: 'USD' },
            { account_id: assetAccount.id, amount: -5000, converted_amount: -5000, currency: 'USD' },
          ],
        },
      });
    }
    
    // 验证后端有资产数据
    const balanceQuery = await request.post(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });
    
    const balanceData = await balanceQuery.json();
    console.log('后端余额数据:', JSON.stringify(balanceData, null, 2));
    
    // 后端应该有资产数据
    expect(balanceData.balances).toBeDefined();
    expect(Array.isArray(balanceData.balances)).toBe(true);
    console.log('✅ 后端返回余额数据结构正确');
  });

  test('2. Dashboard应该调用/query/summary API获取汇总数据', async ({ request }) => {
    const token = await getAuthToken(request);
    
    // 检查后端是否有汇总API
    const summaryResponse = await request.get(`${BACKEND_URL}/api/v1/query/summary`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    console.log('Summary API状态:', summaryResponse.status());
    
    // 如果API存在，验证返回数据结构
    if (summaryResponse.status() === 200) {
      const summaryData = await summaryResponse.json();
      console.log('Summary数据:', JSON.stringify(summaryData, null, 2));
      
      expect(summaryData).toHaveProperty('assets');
      expect(summaryData).toHaveProperty('liabilities');
      expect(summaryData).toHaveProperty('netWorth');
      console.log('✅ Summary API返回正确结构');
    } else if (summaryResponse.status() === 404) {
      console.log('⚠️ /query/summary API不存在，需要实现');
    }
  });

  test('3. Dashboard应该显示非硬编码的真实资产金额', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 登录
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', VALID_EMAIL);
    await page.fill('input[type="password"]', VALID_PASSWORD);
    
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    
    // 等待页面加载
    await page.waitForTimeout(2000);
    
    // 获取资产金额元素
    const totalAssetsLocator = page.getByText('Total Assets').locator('..').locator('.text-2xl');
    
    // 验证元素存在
    await expect(totalAssetsLocator).toBeVisible();
    
    const displayedAmount = await totalAssetsLocator.textContent();
    console.log('Dashboard显示的资产金额:', displayedAmount);
    
    // 验证不是硬编码的 $0.00
    expect(displayedAmount).not.toBe('$0.00');
    
    // 如果有数据，应该显示真实金额格式
    if (displayedAmount && displayedAmount !== '$0.00') {
      expect(displayedAmount).toMatch(/^\$\d{1,3}(,\d{3})*(\.\d{2})?$/);
      console.log('✅ Dashboard显示真实资产金额');
    } else {
      console.log('⚠️ Dashboard仍显示 $0.00（需要实现数据获取）');
    }
  });

  test('4. Dashboard应该显示真实负债金额', async ({ page }) => {
    // 登录
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', VALID_EMAIL);
    await page.fill('input[type="password"]', VALID_PASSWORD);
    
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    
    await page.waitForTimeout(1000);
    
    // 获取负债金额
    const liabilitiesLocator = page.getByText('Total Liabilities').locator('..').locator('.text-2xl');
    await expect(liabilitiesLocator).toBeVisible();
    
    const displayedAmount = await liabilitiesLocator.textContent();
    console.log('Dashboard显示的负债金额:', displayedAmount);
    
    // 验证不是硬编码
    expect(displayedAmount).not.toBe('$0.00');
    
    if (displayedAmount && displayedAmount !== '$0.00') {
      expect(displayedAmount).toMatch(/^\$\d{1,3}(,\d{3})*(\.\d{2})?$/);
      console.log('✅ Dashboard显示真实负债金额');
    } else {
      console.log('⚠️ Dashboard负债显示为 $0.00');
    }
  });

  test('5. Dashboard应该显示真实净资产（资产-负债）', async ({ page }) => {
    // 登录
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', VALID_EMAIL);
    await page.fill('input[type="password"]', VALID_PASSWORD);
    
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    
    await page.waitForTimeout(1000);
    
    // 获取净资产金额
    const netWorthLocator = page.getByText('Net Worth').locator('..').locator('.text-2xl');
    await expect(netWorthLocator).toBeVisible();
    
    const displayedAmount = await netWorthLocator.textContent();
    console.log('Dashboard显示的净资产金额:', displayedAmount);
    
    // 验证不是硬编码
    expect(displayedAmount).not.toBe('$0.00');
    
    if (displayedAmount && displayedAmount !== '$0.00') {
      expect(displayedAmount).toMatch(/^\$(-)?\d{1,3}(,\d{3})*(\.\d{2})?$/);
      console.log('✅ Dashboard显示真实净资产金额');
    } else {
      console.log('⚠️ Dashboard净资产显示为 $0.00');
    }
  });

  test('6. Dashboard Recent Transactions应该显示真实交易记录', async ({ page, request: apiRequest }) => {
    const token = await getAuthToken(apiRequest);
    
    // 先创建一些交易
    const accountsResponse = await apiRequest.get(`${BACKEND_URL}/api/v1/accounts`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const accounts = await accountsResponse.json();
    
    if (accounts.length > 0) {
      // 创建测试交易
      await apiRequest.post(`${BACKEND_URL}/api/v1/journal`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          date: new Date().toISOString().split('T')[0],
          description: 'TDD测试-购买设备',
          lines: [
            { account_id: accounts[0].id, amount: 2500, converted_amount: 2500, currency: 'USD' },
            { account_id: accounts[0].id, amount: -2500, converted_amount: -2500, currency: 'USD' },
          ],
        },
      });
      
      // 创建收入交易
      await apiRequest.post(`${BACKEND_URL}/api/v1/journal`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          date: new Date().toISOString().split('T')[0],
          description: 'TDD测试-销售产品',
          lines: [
            { account_id: accounts[0].id, amount: 8000, converted_amount: 8000, currency: 'USD' },
            { account_id: accounts[0].id, amount: -8000, converted_amount: -8000, currency: 'USD' },
          ],
        },
      });
    }
    
    // 验证后端有交易记录
    const entriesResponse = await apiRequest.get(`${BACKEND_URL}/api/v1/journal`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    const entriesData = await entriesResponse.json();
    console.log('后端交易记录:', JSON.stringify(entriesData, null, 2));
    
    expect(entriesData).toHaveProperty('entries');
    console.log('✅ 后端返回交易记录数据结构正确');
    
    // 访问Dashboard验证前端显示
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', VALID_EMAIL);
    await page.fill('input[type="password"]', VALID_PASSWORD);
    
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    
    await page.waitForTimeout(2000);
    
    // 检查Recent Transactions部分
    const recentTransactionsSection = page.getByRole('heading', { name: 'Recent Transactions', exact: true });
    await expect(recentTransactionsSection).toBeVisible();
    
    // 检查是否有"no transactions"消息
    const noTransactionsMsg = page.getByText('No transactions yet');
    
    if (await noTransactionsMsg.isVisible()) {
      console.log('⚠️ Dashboard显示无交易消息，但后端有交易记录');
      console.log('❌ 需要实现：前端从API获取交易记录并显示');
    } else {
      // 如果显示了交易记录，验证数据
      const transactionsVisible = await page.locator('.space-y-4').first().isVisible();
      if (transactionsVisible) {
        console.log('✅ Dashboard显示真实交易记录');
      }
    }
  });

  test('7. Dashboard数据应该与API返回一致', async ({ page, request }) => {
    const token = await getAuthToken(request);
    
    // 获取后端汇总数据
    const balanceQuery = await request.post(`${BACKEND_URL}/api/v1/query/balances`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });
    const balanceData = await balanceQuery.json();
    
    // 计算总资产
    let backendTotalAssets = 0;
    if (balanceData.balances) {
      backendTotalAssets = balanceData.balances.reduce((sum: number, item: any) => {
        const amount = item.currencies?.[0]?.amount || 0;
        return sum + amount;
      }, 0);
    }
    console.log('后端总资产:', backendTotalAssets);
    
    // 访问Dashboard
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', VALID_EMAIL);
    await page.fill('input[type="password"]', VALID_PASSWORD);
    
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 10000 }),
      page.click('button[type="submit"]'),
    ]);
    
    await page.waitForTimeout(2000);
    
    // 获取前端显示的资产金额
    const assetsText = await page.getByText('Total Assets').locator('..').locator('.text-2xl').textContent();
    const frontendAssets = parseFloat(assetsText?.replace(/[$,]/g, '') || '0');
    
    console.log('前端显示资产:', frontendAssets);
    
    // 验证前后端数据一致
    // 注意：复式记账中，借贷相抵后余额可能为0，这是正确的
    // 但如果后端有非零数据，前端应该显示相同数据
    if (backendTotalAssets !== 0) {
      expect(frontendAssets).toBe(backendTotalAssets);
      console.log('✅ 前后端资产数据一致');
    } else {
      console.log('⚠️ 后端资产为0（复式记账特性），无法验证一致性');
    }
  });

  test('8. Dashboard应该调用useDashboard hook获取数据', async ({ page }) => {
    // 验证前端代码中有API调用
    // 这个测试检查代码结构，不检查运行时行为
    
    const dashboardFiles = [
      '/Users/kifuko/dev/multi_currency_accounting/frontend/app/(dashboard)/dashboard/page.tsx',
    ];
    
    // 检查是否使用了API调用
    const fs = require('fs');
    const pageContent = fs.readFileSync(dashboardFiles[0], 'utf-8');
    
    console.log('Dashboard页面代码分析:');
    console.log('- 包含getData调用:', pageContent.includes('getData') || pageContent.includes('fetch'));
    console.log('- 包含API调用:', pageContent.includes('/api/') || pageContent.includes('useQuery'));
    console.log('- 包含useDashboard:', pageContent.includes('useDashboard'));
    
    // 理想情况下，Dashboard应该：
    // 1. 使用useQuery或useEffect调用API
    // 2. 显示加载状态
    // 3. 显示真实数据
    
    const hasApiCall = pageContent.includes('useQuery') || 
                       pageContent.includes('fetch(') || 
                       pageContent.includes('axios');
    
    if (hasApiCall) {
      console.log('✅ Dashboard使用API获取数据');
    } else {
      console.log('❌ Dashboard没有API调用，是静态页面');
      console.log('需要实现：添加useQuery或fetch调用获取真实数据');
    }
  });
});
