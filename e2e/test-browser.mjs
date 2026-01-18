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
  
  try {
    await page.goto('http://localhost:8068/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log('Page title:', await page.title());
    console.log('\n--- Console Errors ---');
    if (errors.length === 0) {
      console.log('No errors found!');
    } else {
      errors.forEach(e => console.log('ERROR:', e));
    }
  } catch (e) {
    console.log('Navigation error:', e.message);
  }
  
  await browser.close();
})();
