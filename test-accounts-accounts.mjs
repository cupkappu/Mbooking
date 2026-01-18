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
  
  // Check for account names
  const accountNames = await page.locator('.font-medium').all();
  console.log(`Found ${accountNames.length} font-medium elements`);
  
  for (let i = 0; i < Math.min(accountNames.length, 10); i++) {
    const text = await accountNames[i].textContent();
    console.log(`Account ${i}: "${text}"`);
  }
  
  // Check for folder icons
  const folders = await page.locator('.lucide-folder').all();
  console.log(`Folder icons: ${folders.length}`);
  
  // Look for edit buttons near accounts
  const editIcons = await page.locator('svg[width="16"][height="16"]').all();
  console.log(`Small SVG icons: ${editIcons.length}`);
  
  await browser.close();
})();
