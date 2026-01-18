import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Login first
  await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  
  console.log('Going to accounts page...');
  await page.goto('http://localhost:8068/accounts', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // Get the account rows (div with flex items-center)
  const rows = await page.locator('div.flex.items-center.gap-2').all();
  console.log(`Account rows: ${rows.length}`);
  
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const html = await rows[i].innerHTML();
    console.log(`Row ${i}: ${html.substring(0, 200)}...`);
  }
  
  // Find all Edit2 icons in the page
  const allSvgs = await page.locator('svg').all();
  console.log(`\nTotal SVG elements: ${allSvgs.length}`);
  
  // Check for edit-related classes
  const edit2Paths = await page.locator('path[d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"]').all();
  console.log(`Edit2 path matches: ${edit2Paths.length}`);
  
  await browser.close();
})();
