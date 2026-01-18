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
  
  // Find the container that holds all account rows
  const container = page.locator('.space-y-1').first();
  if (await container.isVisible()) {
    console.log('Account container visible');
    
    // Hover over first row
    const firstRow = container.locator('div').first();
    if (await firstRow.isVisible()) {
      console.log('Hovering over first row...');
      await firstRow.hover();
      await page.waitForTimeout(500);
      
      // Now check for buttons
      const buttonsAfterHover = await page.locator('button').all();
      console.log(`Buttons after hover: ${buttonsAfterHover.length}`);
      
      // Check all SVG icons
      const allSvgs = await page.locator('svg').all();
      console.log(`Total SVGs: ${allSvgs.length}`);
      
      // Look for h-3.5 w-3.5 class (size of edit icon)
      const smallIcons = await page.locator('svg.h-3\\.5').all();
      console.log(`Small icons (h-3.5): ${smallIcons.length}`);
    }
  }
  
  await browser.close();
})();
