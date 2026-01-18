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
  
  // Force the opacity to be visible by evaluating JS
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.style.opacity = '1';
      btn.style.transition = 'none';
    });
  });
  
  // Now try to find edit buttons
  const allButtons = await page.locator('button').all();
  console.log(`Total buttons: ${allButtons.length}`);
  
  // Look for buttons with Edit2 class by evaluating
  const hasEdit2 = await page.evaluate(() => {
    const editButtons = document.querySelectorAll('svg.lucide-edit2');
    return editButtons.length;
  });
  console.log(`Edit2 icons found: ${hasEdit2}`);
  
  // Try clicking by position
  const box = await page.locator('text=Test Account').first().boundingBox();
  if (box) {
    console.log(`Found "Test Account" at x:${box.x}, y:${box.y}`);
    // Click slightly to the right where the edit button should be
    await page.mouse.click(box.x + 500, box.y + 10);
    await page.waitForTimeout(1000);
    
    // Check if dialog appeared
    const dialog = await page.locator('text=/(Create|Edit) Account/').first();
    const isDialogVisible = await dialog.isVisible().catch(() => false);
    console.log(`Account dialog visible: ${isDialogVisible}`);
  }
  
  await browser.close();
})();
