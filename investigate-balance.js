const { chromium } = require('playwright');

(async () => {
  console.log('🔍 调查账户余额问题\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. 登录
    console.log('1️⃣  登录 admin@example.com...');
    await page.goto('http://10.66.35.155:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    console.log('   ✅ 登录成功\n');

    // 2. 获取 JWT token
    console.log('2️⃣  获取 JWT token...');
    const token = await page.evaluate(() => {
      return localStorage.getItem('next-auth.session-token') ||
             localStorage.getItem('auth_token') ||
             document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
    });
    console.log('   Token:', token?.slice(0, 50) + '...\n');

    // 3. 导航到账户页面
    console.log('3️⃣  检查账户页面...');
    await page.goto('http://10.66.35.155:8068/accounts', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 获取所有账户信息
    const accounts = await page.$$('[class*="account"], [class*="card"], tr, .flex');
    console.log(`   找到 ${accounts.length} 个账户相关元素`);

    // 获取页面文本中的余额信息
    const pageText = await page.textContent('body');
    const balanceMatches = pageText.match(/[\d,]+\.\d{2}\s*USD/g);
    console.log('   页面中的 USD 余额:', balanceMatches?.slice(0, 10));

    // 4. 检查 test 账户
    console.log('\n4️⃣  查找 test 账户...');
    const testAccount = await page.$('text=test');
    if (testAccount) {
      console.log('   ✅ 找到 test 账户');
      const parent = await testAccount.locator('..').locator('..');
      const accountText = await parent.textContent();
      console.log('   账户信息:', accountText?.slice(0, 200));
    }

    // 5. API 请求验证
    console.log('\n5️⃣  通过 API 验证账户余额...');

    // 先获取账户列表
    const accountsResponse = await page.evaluate(async (token) => {
      const res = await fetch('/api/v1/accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    }, token);
    console.log('   账户列表 API 响应:', JSON.stringify(accountsResponse, null, 2).slice(0, 1000));

    // 获取余额
    const balanceResponse = await page.evaluate(async (token) => {
      const res = await fetch('/api/v1/query/balances', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.json();
    }, token);
    console.log('   余额 API 响应:', JSON.stringify(balanceResponse, null, 2).slice(0, 1000));

    console.log('\n✅ 调查完成，请查看以上信息');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
  } finally {
    await browser.close();
  }
})();
