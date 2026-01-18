import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  
  // Login first
  console.log('1. Going to login page...');
  await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle', timeout: 30000 });
  
  console.log('2. Filling login form...');
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  
  console.log('3. Waiting for dashboard...');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  console.log('   Logged in successfully!');
  
  console.log('4. Going to accounts page...');
  await page.goto('http://localhost:8068/accounts', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  console.log('5. Checking for edit button...');
  const editButtons = page.locator('button');
  const count = await editButtons.count();
  console.log(`   Found ${count} buttons on page`);
  
  // Try to find edit icon
  const editIcons = page.locator('.lucide-edit2, .lucide-edit-2, svg[class*="edit"]');
  const iconCount = await editIcons.count();
  console.log(`   Found ${iconCount} edit icons`);
  
  if (iconCount > 0) {
    console.log('6. Clicking edit button...');
    await editIcons.first().locator('..').click();
    await page.waitForTimeout(2000);
  }
  
  console.log('\n--- Console Errors ---');
  if (errors.length === 0) {
    console.log('No errors found!');
  } else {
    errors.forEach(e => console.log('ERROR:', e));
  }
  
  await browser.close();
})();
