const { chromium } = require('playwright');

(async () => {
  console.log('🎭 Playwright MCP 测试\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 1. 登录
    console.log('1️⃣  登录...');
    await page.goto('http://10.66.35.155:8068/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    console.log('   ✅ 登录成功\n');

    // 2. 测试各页面
    console.log('2️⃣  测试各功能页面...');

    const pages = [
      { url: '/dashboard', name: '仪表盘' },
      { url: '/accounts', name: '账户' },
      { url: '/journal', name: '日记账' },
      { url: '/reports/balance-sheet', name: '资产负债表' },
      { url: '/reports/income-statement', name: '损益表' },
      { url: '/budgets', name: '预算' },
      { url: '/settings', name: '设置' },
      { url: '/admin/users', name: '用户管理' },
    ];

    const results = [];
    for (const p of pages) {
      try {
        await page.goto(`http://10.66.35.155:8068${p.url}`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1000);

        const content = await page.content();
        const hasError = content.includes('"statusCode":500') || content.includes('"statusCode":401');

        if (hasError) {
          results.push(`❌ ${p.name}`);
        } else {
          results.push(`✅ ${p.name}`);
        }
      } catch (error) {
        results.push(`⚠️ ${p.name} (${error.message.slice(0, 20)})`);
      }
    }

    console.log('   ' + results.join(' | '));
    console.log('');

    // 3. 验证用户创建功能
    console.log('3️⃣  测试用户创建...');
    await page.goto('http://10.66.35.155:8068/admin/users', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 点击添加用户
    await page.click('button:has-text("Add User")');
    await page.waitForTimeout(1000);

    // 填写表单
    const inputs = await page.$$('[role="dialog"] input');
    if (inputs.length >= 3) {
      await inputs[0].fill('playwright-test');
      await inputs[1].fill('playwright-test@kifuko.moe');
      await inputs[2].fill('password123');
      await page.click('[role="dialog"] button:has-text("Create User")');
      await page.waitForTimeout(3000);
      console.log('   ✅ 用户创建请求已发送\n');
    }

    // 4. 检查数据库
    console.log('4️⃣  数据库验证...');
    const { execSync } = require('child_process');

    const users = execSync('docker exec accounting-db psql -U accounting -d accounting -c "SELECT COUNT(*) as total FROM users;"').toString();
    console.log('   用户总数:', users.split('\n')[2]?.trim());

    const entries = execSync('docker exec accounting-db psql -U accounting -d accounting -c "SELECT COUNT(*) as total FROM journal_entries;"').toString();
    console.log('   日记账数量:', entries.split('\n')[2]?.trim());

    const accounts = execSync('docker exec accounting-db psql -U accounting -d accounting -c "SELECT COUNT(*) as total FROM accounts;"').toString();
    console.log('   账户数量:', accounts.split('\n')[2]?.trim());
    console.log('');

    // 5. 控制台错误
    console.log('5️⃣  控制台错误检查...');
    const uniqueErrors = [...new Set(consoleErrors)];
    if (uniqueErrors.length > 0) {
      console.log(`   ⚠️  发现 ${uniqueErrors.length} 个错误:`);
      uniqueErrors.slice(0, 3).forEach((err, i) => {
        console.log(`   ${i + 1}. ${err.slice(0, 80)}`);
      });
    } else {
      console.log('   ✅ 无控制台错误');
    }

    console.log('\n🎉 Playwright 测试完成！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
  } finally {
    await browser.close();
  }
})();
