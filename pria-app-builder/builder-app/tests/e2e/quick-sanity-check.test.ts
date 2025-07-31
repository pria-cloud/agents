import { test, expect } from '@playwright/test';

test.describe('PRIA App Builder - Quick Sanity Check', () => {
  test('should load the application', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Should either show login page or dashboard
    const url = page.url();
    console.log('Current URL:', url);
    
    // Check if we're on login or dashboard
    const isOnLogin = url.includes('/login');
    const isOnDashboard = url.includes('/dashboard');
    const isOnRoot = url.endsWith('/') || url.endsWith(':3008') || url.endsWith(':3010');
    
    expect(isOnLogin || isOnDashboard || isOnRoot).toBeTruthy();
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/sanity-check.png' });
  });
  
  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Check page title
    const title = await page.title();
    console.log('Page title:', title);
    
    expect(title).toContain('PRIA');
  });
  
  test('should show authentication UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Look for auth-related elements
    const authElements = [
      'input[type="email"]',
      'input[type="password"]',
      'button[type="submit"]',
      'text=Sign Out',
      'text=Login',
      'text=Sign In'
    ];
    
    let foundAuthElement = false;
    for (const selector of authElements) {
      try {
        const element = await page.locator(selector).first();
        if (await element.count() > 0) {
          foundAuthElement = true;
          console.log('Found auth element:', selector);
          break;
        }
      } catch (e) {
        // Continue checking other selectors
      }
    }
    
    expect(foundAuthElement).toBeTruthy();
  });
});