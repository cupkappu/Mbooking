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
  console.log('1. Logging in...');
  await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
  console.log('   Logged in!');
  
  console.log('2. Going to accounts page...');
  await page.goto('http://localhost:8068/accounts', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  console.log('3. Checking page content...');
  const pageContent = await page.content();
  console.log(`   Page length: ${pageContent.length} chars`);
  
  // Get all button elements
  const buttons = await page.locator('button').all();
  console.log(`   Total buttons: ${buttons.length}`);
  
  // Try to find edit-related buttons by looking for Edit2 icon in SVG
  const svgEdits = await page.locator('svg.lucide-edit2').all();
  console.log(`   Edit2 icons found: ${svgEdits.length}`);
  
  if (svgEdits.length > 0) {
    console.log('4. Clicking edit button...');
    // Get the parent button of the SVG
    const parentButton = svgEdits[0].locator('xpath=..');
    await parentButton.click();
    await page.waitForTimeout(2000);
    
    // Check if dialog appeared
    const dialogs = await page.locator('[role="dialog"]').all();
    console.log(`   Dialogs found: ${dialogs.length}`);
    
    if (dialogs.length > 0) {
      const dialogTitle = await dialogs[0].locator('h2, [role="heading"]').first().textContent();
      console.log(`   Dialog title: ${dialogTitle}`);
    }
  } else {
    console.log('   No edit buttons found');
  }
  
  console.log('\n--- Console Errors ---');
  if (errors.length === 0) {
    console.log('No errors found!');
  } else {
    // Filter out RSC prefetch errors
    const realErrors = errors.filter(e => !e.includes('RSC payload'));
    if (realErrors.length === 0) {
      console.log('No real errors (only RSC prefetch warnings)');
    } else {
      realErrors.forEach(e => console.log('ERROR:', e));
    }
  }
  
  await browser.close();
})();
