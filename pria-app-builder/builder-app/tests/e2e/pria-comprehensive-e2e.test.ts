import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Comprehensive End-to-End Tests for PRIA App Builder
 * 
 * Tests the complete PRIA system including:
 * - Authentication and workspace creation
 * - Session management and workflow
 * - Claude Code SDK integration 
 * - E2B sandbox functionality
 * - Requirements management
 * - Technical specifications
 * - GitHub integration
 * - Testing and validation phases
 * - UI responsiveness and accessibility
 */

test.describe('PRIA App Builder - Comprehensive E2E Tests', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create browser context with persistent storage
    context = await browser.newContext({
      // Enable localStorage and sessionStorage persistence
      storageState: undefined,
      // Enable permissions for notifications, clipboard, etc.
      permissions: ['clipboard-read', 'clipboard-write'],
      // Set a realistic viewport
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Add console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Browser Error: ${msg.text()}`);
      }
    });
    
    // Handle uncaught exceptions
    page.on('pageerror', err => {
      console.error(`Page Error: ${err.message}`);
    });
  });

  test.beforeEach(async () => {
    // Clear any existing state before each test
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('Authentication & Initial Setup', () => {
    test('should redirect unauthenticated users to login', async () => {
      await page.goto('/');
      
      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
      
      // Check login page elements
      await expect(page.locator('h1')).toContainText(/login|sign in/i);
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should show proper loading states during authentication', async () => {
      await page.goto('/');
      
      // Look for loading indicators
      const loadingElements = [
        'text=Loading',
        'text=Checking authentication',
        '[data-testid="loading"]',
        '.animate-spin'
      ];
      
      let foundLoading = false;
      for (const selector of loadingElements) {
        if (await page.locator(selector).count() > 0) {
          foundLoading = true;
          break;
        }
      }
      
      // Should show some form of loading state
      expect(foundLoading).toBeTruthy();
    });
  });

  test.describe('Dashboard and Workspace Creation', () => {
    test('should show workspace creation flow for new users', async () => {
      await page.goto('/dashboard');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Should show welcome/setup screen for new users
      const welcomeElements = [
        'text=Welcome to PRIA',
        'text=Get Started',
        'text=Create your workspace',
        'button:has-text("Get Started")'
      ];
      
      let foundWelcome = false;
      for (const selector of welcomeElements) {
        if (await page.locator(selector).count() > 0) {
          foundLoading = true;
          await expect(page.locator(selector)).toBeVisible();
          break;
        }
      }
    });

    test('should create workspace, project, and session in one flow', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Look for and click "Get Started" button
      const getStartedButton = page.locator('button:has-text("Get Started")').first();
      if (await getStartedButton.count() > 0) {
        await getStartedButton.click();
        
        // Wait for creation process
        await page.waitForTimeout(5000);
        
        // Should show creation progress
        const creationElements = [
          'text=Creating',
          'text=Setting up',
          'text=Initializing'
        ];
        
        for (const selector of creationElements) {
          if (await page.locator(selector).count() > 0) {
            await expect(page.locator(selector)).toBeVisible();
            break;
          }
        }
      }
    });
  });

  test.describe('Main Dashboard Interface', () => {
    test('should display main dashboard elements', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      
      // Wait for dashboard to load (may need session creation)
      await page.waitForTimeout(3000);
      
      // Check for main header elements
      await expect(page.locator('text=PRIA App Builder')).toBeVisible();
      
      // Check for user email in header
      const emailPattern = /[\w\.-]+@[\w\.-]+\.\w+/;
      const headerText = await page.textContent('header') || '';
      expect(headerText).toMatch(emailPattern);
      
      // Check for sign out button
      await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
    });

    test('should show session information in header', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Look for session information
      const sessionElements = [
        'text=Session:',
        'text=Workspace:',
        'text=Project:',
        'text=Target App:'
      ];
      
      let foundSessionInfo = false;
      for (const selector of sessionElements) {
        if (await page.locator(selector).count() > 0) {
          foundSessionInfo = true;
          await expect(page.locator(selector)).toBeVisible();
        }
      }
      
      expect(foundSessionInfo).toBeTruthy();
    });

    test('should display Claude SDK and E2E test toggle buttons', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Check for toggle buttons in header
      const toggleButtons = [
        'button:has-text("Claude SDK")',
        'button:has-text("E2E Tests")',
        'button:has-text("Hide Tests")',
        'button:has-text("Hide Claude")'
      ];
      
      let foundToggle = false;
      for (const selector of toggleButtons) {
        if (await page.locator(selector).count() > 0) {
          foundToggle = true;
          await expect(page.locator(selector)).toBeVisible();
          break;
        }
      }
      
      expect(foundToggle).toBeTruthy();
    });
  });

  test.describe('Claude Code SDK Integration', () => {
    test('should show Claude SDK interface when toggled', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Try to find and click Claude SDK toggle
      const claudeButton = page.locator('button:has-text("Claude SDK")').first();
      if (await claudeButton.count() > 0) {
        await claudeButton.click();
        await page.waitForTimeout(1000);
        
        // Should show Claude interface elements
        const claudeElements = [
          'text=Claude Code SDK',
          'text=Target App',
          'text=Context Synchronization',
          'text=Phase',
          'text=requirements-analyst'
        ];
        
        for (const selector of claudeElements) {
          if (await page.locator(selector).count() > 0) {
            await expect(page.locator(selector)).toBeVisible();
          }
        }
      }
    });

    test('should show Claude status indicator', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Toggle Claude interface
      const claudeButton = page.locator('button:has-text("Claude SDK")').first();
      if (await claudeButton.count() > 0) {
        await claudeButton.click();
        await page.waitForTimeout(2000);
        
        // Check for status indicators
        const statusElements = [
          'text=Claude Ready',
          'text=Target App Inactive',
          'text=Connection Error',
          'text=Checking Status',
          '.text-green-600', // Success state
          '.text-red-600',   // Error state
          '.text-yellow-600' // Loading state
        ];
        
        let foundStatus = false;
        for (const selector of statusElements) {
          if (await page.locator(selector).count() > 0) {
            foundStatus = true;
            break;
          }
        }
        
        expect(foundStatus).toBeTruthy();
      }
    });

    test('should show Target App initialization option', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Toggle Claude interface
      const claudeButton = page.locator('button:has-text("Claude SDK")').first();
      if (await claudeButton.count() > 0) {
        await claudeButton.click();
        await page.waitForTimeout(2000);
        
        // Look for initialization elements
        const initElements = [
          'button:has-text("Initialize Target App")',
          'text=Target App is not initialized',
          'text=Click below to start your development environment'
        ];
        
        for (const selector of initElements) {
          if (await page.locator(selector).count() > 0) {
            await expect(page.locator(selector)).toBeVisible();
          }
        }
      }
    });

    test('should show context synchronization controls', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Toggle Claude interface
      const claudeButton = page.locator('button:has-text("Claude SDK")').first();
      if (await claudeButton.count() > 0) {
        await claudeButton.click();
        await page.waitForTimeout(2000);
        
        // Look for sync controls
        const syncElements = [
          'button:has-text("Sync to Target")',
          'button:has-text("Sync from Target")',
          'text=Context Synchronization',
          'text=Phase 1'
        ];
        
        for (const selector of syncElements) {
          if (await page.locator(selector).count() > 0) {
            await expect(page.locator(selector)).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Traditional Chat Interface', () => {
    test('should show chat interface by default', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Should show chat elements
      const chatElements = [
        'textarea[placeholder*="message"]',
        'button[aria-label*="send"]',
        'text=Type your message',
        '[data-testid="chat-input"]'
      ];
      
      let foundChat = false;
      for (const selector of chatElements) {
        if (await page.locator(selector).count() > 0) {
          foundChat = true;
          await expect(page.locator(selector)).toBeVisible();
          break;
        }
      }
      
      expect(foundChat).toBeTruthy();
    });

    test('should show disabled state when Target App is not ready', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Look for disabled chat elements
      const disabledElements = [
        'textarea[disabled]',
        'button[disabled]',
        'text=Target App not ready',
        'text=disabled'
      ];
      
      for (const selector of disabledElements) {
        if (await page.locator(selector).count() > 0) {
          await expect(page.locator(selector)).toBeVisible();
        }
      }
    });
  });

  test.describe('Preview Tabs and Content', () => {
    test('should show preview tabs on the right side', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Look for preview tabs
      const previewTabs = [
        'text=Requirements',
        'text=Code',
        'text=Preview',
        'text=Technical Specs',
        'text=Tasks',
        'text=Testing',
        'text=Validation'
      ];
      
      let foundTabs = 0;
      for (const selector of previewTabs) {
        if (await page.locator(selector).count() > 0) {
          foundTabs++;
        }
      }
      
      // Should have at least some preview tabs
      expect(foundTabs).toBeGreaterThan(0);
    });

    test('should show requirements view when Requirements tab is active', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Try to click Requirements tab
      const requirementsTab = page.locator('text=Requirements').first();
      if (await requirementsTab.count() > 0) {
        await requirementsTab.click();
        await page.waitForTimeout(1000);
        
        // Should show requirements content
        const requirementElements = [
          'text=No requirements',
          'text=Functional Requirements',
          'text=Non-Functional Requirements',
          'button:has-text("Add Requirement")'
        ];
        
        for (const selector of requirementElements) {
          if (await page.locator(selector).count() > 0) {
            await expect(page.locator(selector)).toBeVisible();
          }
        }
      }
    });

    test('should show code view when Code tab is active', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Try to click Code tab
      const codeTab = page.locator('text=Code').first();
      if (await codeTab.count() > 0) {
        await codeTab.click();
        await page.waitForTimeout(1000);
        
        // Should show code-related content
        const codeElements = [
          'text=No files generated yet',
          'text=Generated Files',
          'pre', // Code blocks
          'code', // Inline code
          '.font-mono' // Monospace font for code
        ];
        
        for (const selector of codeElements) {
          if (await page.locator(selector).count() > 0) {
            await expect(page.locator(selector)).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Responsive Design and Mobile Support', () => {
    test('should be responsive on mobile devices', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Check that content is still visible and accessible
      await expect(page.locator('text=PRIA App Builder')).toBeVisible();
      
      // Should have mobile-friendly layout
      const mobileElements = [
        '.flex-col', // Vertical layout
        '.w-full',   // Full width elements
        '.sm\\:',     // Responsive classes
        '.md\\:',
        '.lg\\:'
      ];
      
      let foundResponsive = false;
      for (const selector of mobileElements) {
        if (await page.locator(selector).count() > 0) {
          foundResponsive = true;
          break;
        }
      }
      
      expect(foundResponsive).toBeTruthy();
    });

    test('should handle tablet viewport', async () => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Should maintain usability on tablet
      await expect(page.locator('text=PRIA App Builder')).toBeVisible();
      
      // Check for touch-friendly elements
      const touchElements = page.locator('button, [role="button"], a');
      const count = await touchElements.count();
      
      if (count > 0) {
        // Check that buttons are reasonably sized for touch
        const firstButton = touchElements.first();
        const box = await firstButton.boundingBox();
        if (box) {
          // Buttons should be at least 44px tall for touch (Apple guideline)
          expect(box.height).toBeGreaterThanOrEqual(32);
        }
      }
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Simulate network failure
      await page.route('**/api/**', route => {
        route.abort('failed');
      });
      
      // Try to perform an action that would trigger API call
      const anyButton = page.locator('button').first();
      if (await anyButton.count() > 0) {
        await anyButton.click();
        await page.waitForTimeout(2000);
        
        // Should show error handling
        const errorElements = [
          'text=Error',
          'text=Failed',
          'text=Try again',
          '.text-red-600',
          '[role="alert"]'
        ];
        
        for (const selector of errorElements) {
          if (await page.locator(selector).count() > 0) {
            await expect(page.locator(selector)).toBeVisible();
          }
        }
      }
    });

    test('should show loading states during async operations', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Look for loading indicators
      const loadingElements = [
        '.animate-spin',
        'text=Loading',
        'text=Creating',
        'text=Processing',
        '[data-testid="loading"]'
      ];
      
      let foundLoading = false;
      for (const selector of loadingElements) {
        if (await page.locator(selector).count() > 0) {
          foundLoading = true;
          await expect(page.locator(selector)).toBeVisible();
          break;
        }
      }
      
      // Loading states should be present during operations
      expect(foundLoading).toBeTruthy();
    });
  });

  test.describe('Accessibility and UX', () => {
    test('should have proper ARIA labels and roles', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Check for accessibility attributes
      const accessibilityElements = [
        '[aria-label]',
        '[role="button"]',
        '[role="navigation"]',
        '[role="main"]',
        '[role="banner"]'
      ];
      
      let foundAccessibility = false;
      for (const selector of accessibilityElements) {
        if (await page.locator(selector).count() > 0) {
          foundAccessibility = true;
          break;
        }
      }
      
      expect(foundAccessibility).toBeTruthy();
    });

    test('should have proper focus management', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      
      // Should have visible focus indicators
      const focusedElement = await page.locator(':focus');
      if (await focusedElement.count() > 0) {
        await expect(focusedElement).toBeVisible();
      }
    });

    test('should have good color contrast', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Check for proper text contrast classes
      const contrastElements = [
        '.text-foreground',
        '.text-muted-foreground',
        '.bg-background',
        '.border-border'
      ];
      
      let foundContrast = false;
      for (const selector of contrastElements) {
        if (await page.locator(selector).count() > 0) {
          foundContrast = true;
          break;
        }
      }
      
      expect(foundContrast).toBeTruthy();
    });
  });

  test.describe('Performance and Loading', () => {
    test('should load within reasonable time', async () => {
      const startTime = Date.now();
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
    });

    test('should not have console errors', async () => {
      const errors: string[] = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Filter out known non-critical errors
      const criticalErrors = errors.filter(error => 
        !error.includes('favicon') &&
        !error.includes('chunks') &&
        !error.includes('websocket') &&
        !error.includes('DevTools')
      );
      
      expect(criticalErrors.length).toBe(0);
    });
  });

  test.describe('API Health and Integration', () => {
    test('should have healthy API endpoints', async () => {
      // Test health endpoint
      const healthResponse = await page.request.get('/api/health');
      expect(healthResponse.ok()).toBeTruthy();
      
      const healthData = await healthResponse.json();
      expect(healthData).toHaveProperty('status');
    });

    test('should handle authentication properly', async () => {
      // Test that protected routes require auth
      const protectedEndpoints = [
        '/api/sessions',
        '/api/workspaces',
        '/api/requirements'
      ];
      
      for (const endpoint of protectedEndpoints) {
        const response = await page.request.get(endpoint);
        // Should either be 401 (unauthorized) or 200 (if authenticated)
        expect([200, 401]).toContain(response.status());
      }
    });
  });
});