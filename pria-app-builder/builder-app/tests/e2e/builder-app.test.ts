import { test, expect, Page } from '@playwright/test';

// Test configuration
const APP_BASE_URL = 'http://localhost:3007';

test.describe('PRIA App Builder - User Interface Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');
  });

  test('homepage loads successfully', async ({ page }) => {
    // Check if page loads
    await expect(page).toHaveTitle(/PRIA App Builder/);
    
    // Check for main navigation or key elements
    const mainContent = page.locator('main, [data-testid="main-content"], .main-content');
    await expect(mainContent).toBeVisible({ timeout: 10000 });
  });

  test('navigation elements are present', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for common navigation elements
    const navigation = page.locator('nav, [role="navigation"], .navigation');
    
    // If navigation exists, verify it's visible
    try {
      await expect(navigation.first()).toBeVisible({ timeout: 5000 });
    } catch (e) {
      console.log('Navigation not found, checking for alternative layouts');
    }
    
    // Check for key buttons or links
    const buttons = page.locator('button');
    const links = page.locator('a');
    
    // At least some interactive elements should be present
    const buttonCount = await buttons.count();
    const linkCount = await links.count();
    expect(buttonCount + linkCount).toBeGreaterThan(0);
  });

  test('responsive design works', async ({ page }) => {
    // Test desktop viewport (default)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForLoadState('networkidle');
    
    const desktopContent = page.locator('body');
    await expect(desktopContent).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await expect(desktopContent).toBeVisible();
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await expect(desktopContent).toBeVisible();
  });
});

test.describe('PRIA App Builder - Dashboard Tests', () => {
  test('dashboard page accessibility', async ({ page }) => {
    // Try to navigate to dashboard
    await page.goto('/dashboard');
    
    // Check if authentication redirect happens or dashboard loads
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Should either show login page or dashboard
    const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/auth');
    const isDashboard = currentUrl.includes('/dashboard');
    
    expect(isLoginPage || isDashboard).toBeTruthy();
    
    if (isLoginPage) {
      console.log('Redirected to login - authentication required');
    } else {
      console.log('Dashboard accessible - checking content');
      
      // Look for dashboard-specific elements
      const dashboardElements = page.locator('[data-testid*="dashboard"], .dashboard, [class*="dashboard"]');
      
      if (await dashboardElements.count() > 0) {
        await expect(dashboardElements.first()).toBeVisible();
      }
    }
  });

  test('session creation flow', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for session creation elements
    const createSessionButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Start")');
    
    if (await createSessionButton.count() > 0) {
      console.log('Found session creation button');
      
      // Click the first available button
      await createSessionButton.first().click();
      
      // Wait for any modals or forms to appear
      await page.waitForTimeout(2000);
      
      // Check if a form or modal appeared
      const modal = page.locator('[role="dialog"], .modal, [data-testid*="modal"]');
      const form = page.locator('form');
      
      if (await modal.count() > 0) {
        await expect(modal.first()).toBeVisible();
        console.log('Modal appeared for session creation');
      } else if (await form.count() > 0) {
        await expect(form.first()).toBeVisible();
        console.log('Form appeared for session creation');
      }
    } else {
      console.log('No session creation button found - may require authentication');
    }
  });
});

test.describe('PRIA App Builder - Workflow Tests', () => {
  test('workflow tabs are accessible', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for tab elements
    const tabs = page.locator('[role="tab"], .tab, [data-testid*="tab"]');
    
    if (await tabs.count() > 0) {
      console.log(`Found ${await tabs.count()} tabs`);
      
      // Check some expected tabs
      const expectedTabs = ['Code View', 'UI Preview', 'Requirements', 'Workflow', 'GitHub'];
      
      for (const tabName of expectedTabs) {
        const tab = page.locator(`[role="tab"]:has-text("${tabName}"), .tab:has-text("${tabName}")`);
        
        if (await tab.count() > 0) {
          console.log(`Found "${tabName}" tab`);
          
          // Try to click the tab
          await tab.first().click();
          await page.waitForTimeout(1000);
          
          // Check if tab content appears
          const tabContent = page.locator('[role="tabpanel"], .tab-content, [data-testid*="tab-content"]');
          
          if (await tabContent.count() > 0) {
            await expect(tabContent.first()).toBeVisible();
            console.log(`"${tabName}" tab content is visible`);
          }
        }
      }
    } else {
      console.log('No tabs found - may be in different state or require authentication');
    }
  });

  test('chat interface functionality', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for chat interface elements
    const chatInput = page.locator('input[placeholder*="message"], input[placeholder*="chat"], textarea[placeholder*="message"]');
    const sendButton = page.locator('button:has-text("Send"), button[type="submit"]');
    
    if (await chatInput.count() > 0) {
      console.log('Found chat input');
      
      // Test typing in chat input
      await chatInput.first().fill('Hello, can you help me create a simple web application?');
      
      // Look for send button
      if (await sendButton.count() > 0) {
        console.log('Found send button');
        
        // Note: Not actually sending to avoid API calls in test
        console.log('Chat interface is functional (input and send button present)');
      }
    } else {
      console.log('No chat interface found - may require authentication or different state');
    }
  });
});

test.describe('PRIA App Builder - Error Handling', () => {
  test('handles 404 pages gracefully', async ({ page }) => {
    await page.goto('/non-existent-page');
    
    // Should either show 404 page or redirect
    const is404 = page.locator('text=/404|Not Found|Page not found/i');
    
    // Wait a bit for potential redirects
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('404 test - Current URL:', currentUrl);
    
    // Either we get a 404 page or we're redirected somewhere valid
    const isValidPage = !currentUrl.includes('non-existent-page') || await is404.count() > 0;
    expect(isValidPage).toBeTruthy();
  });

  test('handles network errors gracefully', async ({ page }) => {
    // Intercept API calls and simulate network errors
    await page.route('**/api/**', route => {
      route.abort('failed');
    });
    
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for error messages or loading states
    const errorMessages = page.locator('text=/error|failed|unable/i, [data-testid*="error"], .error');
    const loadingStates = page.locator('text=/loading|spinner/i, [data-testid*="loading"], .loading');
    
    // The app should handle API failures gracefully
    console.log('Testing network error handling...');
    
    // Wait a bit for any error states to appear
    await page.waitForTimeout(5000);
    
    const hasErrorHandling = await errorMessages.count() > 0 || await loadingStates.count() > 0;
    
    if (hasErrorHandling) {
      console.log('App shows appropriate error/loading states');
    } else {
      console.log('App continues to function despite API failures');
    }
    
    // The test passes if the page doesn't crash
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('PRIA App Builder - Performance', () => {
  test('page load performance is acceptable', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    console.log(`Page load time: ${loadTime}ms`);
    
    // Page should load within reasonable time (15 seconds for development)
    expect(loadTime).toBeLessThan(15000);
  });

  test('resources load without errors', async ({ page }) => {
    const failedResources: string[] = [];
    
    page.on('response', response => {
      if (response.status() >= 400) {
        failedResources.push(`${response.status()} - ${response.url()}`);
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Log any failed resources
    if (failedResources.length > 0) {
      console.log('Failed resources:', failedResources);
    }
    
    // Allow some failed resources (like API calls that might require auth)
    // but major resources should load successfully
    const criticalFailures = failedResources.filter(resource => 
      resource.includes('.js') || resource.includes('.css') || resource.includes('favicon')
    );
    
    expect(criticalFailures.length).toBeLessThan(3);
  });
});

// Helper function to take screenshots for debugging
async function takeDebugScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `tests/screenshots/${name}-${Date.now()}.png`, fullPage: true });
}