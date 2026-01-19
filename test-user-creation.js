const { chromium } = require('playwright');

(async () => {
  console.log('🚀 开始测试用户创建和验证流程...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 1. 登录
    console.log('📍 步骤 1: 登录为 admin');
    await page.goto('http://10.66.35.155:8068/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    console.log('   ✅ 登录成功');

    // 2. 导航到管理用户页面
    console.log('\n📍 步骤 2: 导航到管理用户页面');
    await page.goto('http://10.66.35.155:8068/admin/users', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('   ✅ 页面已加载');

    // 3. 点击添加用户按钮
    console.log('\n📍 步骤 3: 点击"添加用户"按钮');
    await page.click('button:has-text("Add User")');
    await page.waitForTimeout(1500);

    // 4. 填写用户表单 - 使用对话框中的可见输入框
    console.log('\n📍 步骤 4: 填写用户信息');

    // 在对话框中按位置查找输入框
    // 第一个是 Name (无type), 第二个是 Email (type="email"), 第三个是 Password (type="password")
    const dialogInputs = await page.$$('[role="dialog"] input, dialog input');
    console.log(`   找到对话框中的 ${dialogInputs.length} 个输入框`);

    if (dialogInputs.length >= 3) {
      // Name 输入框
      await dialogInputs[0].fill('test3');
      console.log('   ✅ 已填写 Name');

      // Email 输入框
      await dialogInputs[1].fill('test3@kifuko.moe');
      console.log('   ✅ 已填写 Email');

      // Password 输入框
      await dialogInputs[2].fill('password123');
      console.log('   ✅ 已填写 Password');

      // 选择 Role (user)
      console.log('   ✅ Role 默认为 user');

      // 点击 Create User 按钮
      await page.click('[role="dialog"] button:has-text("Create User")');
      await page.waitForTimeout(3000);
      console.log('   ✅ 用户创建请求已发送');
    } else {
      throw new Error(`对话框输入框数量不足: ${dialogInputs.length}`);
    }

    // 5. 验证用户是否创建成功
    console.log('\n📍 步骤 5: 验证用户创建');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const userRow = await page.$('text=test3@kifuko.moe');
    if (userRow) {
      console.log('   ✅ 用户 test3@kifuko.moe 创建成功');
    } else {
      console.log('   ⚠️  未找到用户 test3@kifuko.moe');

      // 获取当前所有用户
      const allUsers = await page.$$('table tbody tr');
      console.log(`   现有用户行数: ${allUsers.length}`);

      for (const row of allUsers) {
        const text = await row.textContent();
        console.log(`   - ${text?.slice(0, 80)}`);
      }
    }

    // 6. 检查各功能页面
    console.log('\n📍 步骤 6: 检查各功能页面');

    const pages = [
      { url: '/dashboard', name: '仪表盘' },
      { url: '/accounts', name: '账户' },
      { url: '/journal', name: '日记账' },
      { url: '/reports/balance-sheet', name: '资产负债表' },
      { url: '/reports/income-statement', name: '损益表' },
      { url: '/budgets', name: '预算' },
      { url: '/settings', name: '设置' },
    ];

    const pageResults = [];

    for (const p of pages) {
      try {
        await page.goto(`http://10.66.35.155:8068${p.url}`, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1500);

        // 检查是否有错误
        const pageContent = await page.content();
        const hasError = pageContent.includes('"statusCode":500') || pageContent.includes('"statusCode":401') || pageContent.includes('"statusCode":403');
        const hasLoading = await page.$('text=Loading...');

        if (hasError) {
          pageResults.push({ name: p.name, url: p.url, status: '❌ API错误' });
        } else if (hasLoading) {
          pageResults.push({ name: p.name, url: p.url, status: '⏳ 加载中' });
        } else {
          pageResults.push({ name: p.name, url: p.url, status: '✅ 正常' });
        }
      } catch (error) {
        pageResults.push({ name: p.name, url: p.url, status: `❌ ${error.message.slice(0, 30)}` });
      }
    }

    console.log('\n   页面检查结果:');
    pageResults.forEach(r => console.log(`   ${r.status}  ${r.name} (${r.url})`));

    // 7. 检查数据库中的用户
    console.log('\n📍 步骤 7: 检查数据库中的用户');
    const { execSync } = require('child_process');
    const users = execSync('docker exec accounting-db psql -U accounting -d accounting -c "SELECT id, email, tenant_id, role FROM users ORDER BY created_at DESC LIMIT 5;"').toString();
    console.log(users);

    // 8. 检查账户数据
    console.log('\n📍 步骤 8: 检查账户数据');
    const accounts = execSync('docker exec accounting-db psql -U accounting -d accounting -c "SELECT id, name, tenant_id FROM accounts LIMIT 5;"').toString();
    console.log(accounts);

    // 9. 检查日记账数据
    console.log('\n📍 步骤 9: 检查日记账数据');
    const journal = execSync('docker exec accounting-db psql -U accounting -d accounting -c "SELECT COUNT(*) as entries FROM journal_entries; SELECT COUNT(*) as lines FROM journal_lines;"').toString();
    console.log(journal);

    // 10. 检查资产负债表数据
    console.log('\n📍 步骤 10: 检查资产负债表查询');
    try {
      const balanceData = execSync('docker exec accounting-db psql -U accounting -d accounting -c "SELECT DISTINCT je.tenant_id, COUNT(je.id) as entry_count FROM journal_entries je GROUP BY je.tenant_id;"').toString();
      console.log(balanceData);
    } catch (e) {
      console.log('   查询失败:', e.message);
    }

    // 11. 报告控制台错误
    console.log('\n📍 步骤 11: 检查控制台错误');
    if (consoleErrors.length > 0) {
      console.log(`   发现 ${consoleErrors.length} 个控制台错误:`);
      consoleErrors.slice(0, 5).forEach((err, i) => console.log(`   ${i + 1}. ${err.slice(0, 100)}`));
    } else {
      console.log('   ✅ 无控制台错误');
    }

    console.log('\n🎉 测试完成！\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
