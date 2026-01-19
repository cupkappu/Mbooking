const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://10.66.35.155:8068/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });

  await page.goto('http://10.66.35.155:8068/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Get all table rows
  const rows = await page.$$('table tbody tr');
  console.log('用户列表:');
  for (const row of rows) {
    const cells = await row.$$('td');
    const data = await Promise.all(cells.map(c => c.textContent()));
    console.log('  -', data.join(' | '));
  }

  // Get total count from description
  const description = await page.$eval('p.text-muted-foreground', el => el.textContent).catch(() => 'N/A');
  console.log('\n用户总数:', description);

  await browser.close();
})();
