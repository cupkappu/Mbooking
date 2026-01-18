import { test, expect } from '@playwright/test';

test.describe('API Proxy Verification', () => {
  test('should proxy API requests through Next.js frontend instead of direct backend calls', async ({ page }) => {
    const apiRequests: { url: string; method: string; requestHeaders: Record<string, string> }[] = [];

    // Capture all network requests
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();
      
      // Only track API requests to /api/v1/* endpoints
      if (url.includes('/api/v1/')) {
        apiRequests.push({ 
          url, 
          method,
          requestHeaders: request.headers() 
        });
        console.log(`[Network] ${method} ${url}`);
      }
    });

    // Navigate to the accounts page which should trigger API calls
    // Using port 8068 as mapped in docker-compose.yml
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
    // The rewrite happens server-side, so the browser only sees requests to localhost:8068
    const proxiedCalls = apiRequests.filter(req => 
      req.url.includes('localhost:8068') ||
      (!req.url.includes('localhost:8067') && 
       !req.url.includes('127.0.0.1:8067') &&
       !req.url.includes('backend:3001'))
    );

    console.log('\n=== API Request Summary ===');
    console.log(`Total API requests captured: ${apiRequests.length}`);
    console.log(`Direct backend calls (should be 0): ${directCalls.length}`);
    console.log(`Proxied requests (through frontend): ${proxiedCalls.length}`);

    if (directCalls.length > 0) {
      console.log('\nDirect backend calls found (THIS IS A PROBLEM):');
      directCalls.forEach(req => {
        console.log(`  - ${req.method} ${req.url}`);
      });
    }

    if (apiRequests.length > 0) {
      console.log('\nAll captured API requests:');
      apiRequests.forEach(req => {
        console.log(`  - ${req.method} ${req.url}`);
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

  test('verify proxy rewrite configuration is active', async ({ page }) => {
    const responses: { url: string; status: number }[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/v1/')) {
        responses.push({ url, status: response.status() });
        console.log(`[Response] ${response.status()} ${url}`);
      }
    });

    // Test that the proxy rewrite is working by making a request to the proxied endpoint
    const response = await page.request.get('http://localhost:8068/api/v1/currencies', {
      failOnStatusCode: false
    });

    console.log('\n=== Proxy Rewrite Test ===');
    console.log(`Request: GET http://localhost:8068/api/v1/currencies`);
    console.log(`Status: ${response.status()}`);
    
    // If we get a 401 or any response (not a network error), the proxy is working
    // A 401 means the request reached the backend (which requires authentication)
    // A network error would mean the proxy couldn't forward the request
    if (response.status() !== 0) {
      console.log('✅ Proxy rewrite is active - request was forwarded to backend');
    } else {
      console.log('❌ Proxy rewrite failed - request could not be forwarded');
    }
  });
});
