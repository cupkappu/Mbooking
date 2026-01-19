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
  await page.waitForTimeout(1000);

  // Click Add User button
  await page.click('button:has-text("Add User")');
  await page.waitForTimeout(1500);

  // Get all input fields in the dialog
  const inputs = await page.$$('input');
  console.log('Total inputs found:', inputs.length);

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const name = await input.getAttribute('name');
    const type = await input.getAttribute('type');
    const placeholder = await input.getAttribute('placeholder');
    const id = await input.getAttribute('id');
    console.log(`Input ${i}: name=${name}, type=${type}, placeholder=${placeholder}, id=${id}`);
  }

  // Get all select elements
  const selects = await page.$$('select');
  console.log('\nTotal selects found:', selects.length);
  for (let i = 0; i < selects.length; i++) {
    const s = selects[i];
    const name = await s.getAttribute('name');
    console.log(`Select ${i}: name=${name}`);
  }

  // Get all buttons
  const buttons = await page.$$('button');
  console.log('\nTotal buttons found:', buttons.length);
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const text = await b.textContent();
    console.log(`Button ${i}: text=${text?.trim()}`);
  }

  await browser.close();
})();
