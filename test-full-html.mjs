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
  
  // Get the card content by order (2nd card is the Account Tree card)
  const cards = await page.locator('.rounded-lg.border.bg-card').all();
  console.log(`Cards found: ${cards.length}`);
  
  if (cards.length > 1) {
    const html = await cards[1].innerHTML();
    console.log(`\nCard 2 HTML (first 3000 chars):`);
    console.log(html.substring(0, 3000));
  }
  
  await browser.close();
})();
