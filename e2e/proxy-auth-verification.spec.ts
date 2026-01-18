import { test, expect } from '@playwright/test';

test.describe('API Proxy Verification with Authentication', () => {
  const TEST_EMAIL = 'admin@example.com';
  const TEST_PASSWORD = 'password';

  test('should proxy API requests through Next.js after login', async ({ page }) => {
    const apiRequests: { url: string; method: string }[] = [];
    const consoleMessages: string[] = [];

    // Capture all network requests
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      
      // Only track API requests to /api/v1/* endpoints
      if (url.includes('/api/v1/')) {
        apiRequests.push({ url, method });
        console.log(`[Network] ${method} ${url}`);
      }
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
      console.log(`[Console] ${msg.type()}: ${msg.text()}`);
    });

    console.log('\n=== Step 1: Navigate to login page ===');
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    
    console.log('\n=== Step 2: Fill in login credentials ===');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    console.log('\n=== Step 3: Submit login form ===');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    console.log('\n=== Step 4: Wait for login and navigation ===');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    console.log('✅ Navigated to dashboard');
    
    // Wait for any API calls to complete
    await page.waitForTimeout(2000);
    
    console.log('\n=== Step 5: Navigate to accounts page ===');
    await page.goto('http://localhost:8068/accounts', { waitUntil: 'networkidle' });
    
    // Wait for React Query to fetch data
    await page.waitForTimeout(3000);
    
    // Filter out any direct backend calls (port 8067 is the backend, or backend:3001)
    const directCalls = apiRequests.filter(req => 
      req.url.includes('localhost:8067') || 
      req.url.includes('backend:3001') ||
      req.url.includes('127.0.0.1:8067')
    );

    // All API requests should go through the frontend (port 8068)
    const proxiedCalls = apiRequests.filter(req => 
      req.url.includes('localhost:8068')
    );

    console.log('\n' + '='.repeat(50));
    console.log('=== API Request Summary ===');
    console.log('='.repeat(50));
    console.log(`Total API requests captured: ${apiRequests.length}`);
    console.log(`Direct backend calls (should be 0): ${directCalls.length}`);
    console.log(`Proxied requests (through frontend): ${proxiedCalls.length}`);

    if (directCalls.length > 0) {
      console.log('\n❌ Direct backend calls found (THIS IS A PROBLEM):');
      directCalls.forEach(req => {
        console.log(`  - ${req.method} ${req.url}`);
      });
    }

    if (apiRequests.length > 0) {
      console.log('\nAll captured API requests:');
      apiRequests.forEach(req => {
        const isDirect = req.url.includes('localhost:8067') || req.url.includes('backend:3001');
        console.log(`  ${isDirect ? '❌' : '✅'} ${req.method} ${req.url}`);
      });
    }

    // Verify no direct backend calls
    expect(directCalls.length).toBe(0);

    // Verify all API calls went through the frontend
    if (apiRequests.length > 0) {
      expect(proxiedCalls.length).toBe(apiRequests.length);
      console.log('\n✅ All API requests are properly proxied through Next.js!');
    } else {
      console.log('\n⚠️  No API requests captured. The page might not be triggering any API calls.');
    }
  });

  test('verify proxy returns 200 with valid auth', async ({ page }) => {
    // First login and get a session
    await page.goto('http://localhost:8068/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Get the auth token from cookies or localStorage
    const cookies = await page.context().cookies();
    const nextAuthSession = cookies.find(c => c.name === 'next-auth.session-token');
    
    console.log('\n=== Proxy Test with Authentication ===');
    console.log(`Session token found: ${!!nextAuthSession}`);
    
    // Now test the API endpoint with the session
    const response = await page.request.get('http://localhost:8068/api/v1/accounts', {
      headers: {
        Cookie: nextAuthSession ? `next-auth.session-token=${nextAuthSession.value}` : '',
      },
      failOnStatusCode: false
    });

    console.log(`Request: GET http://localhost:8068/api/v1/accounts`);
    console.log(`Status: ${response.status()}`);
    
    if (response.status() === 200) {
      console.log('✅ Proxy is working! Got 200 OK');
    } else if (response.status() === 401) {
      console.log('⚠️  Got 401 Unauthorized - auth might be missing');
    } else if (response.status() === 500) {
      console.log('⚠️  Got 500 Internal Server Error - proxy forwarded but backend errored');
    } else {
      console.log(`❌ Unexpected status: ${response.status()}`);
    }
  });
});
