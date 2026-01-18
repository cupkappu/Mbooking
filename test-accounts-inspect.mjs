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
  
  // Get all buttons and their inner HTML
  const buttons = await page.locator('button').all();
  console.log(`Total buttons: ${buttons.length}`);
  
  for (let i = 0; i < Math.min(buttons.length, 10); i++) {
    const html = await buttons[i].innerHTML();
    const text = await buttons[i].textContent();
    console.log(`Button ${i}: "${text.trim()}" - HTML: ${html.substring(0, 100)}...`);
  }
  
  await browser.close();
})();
