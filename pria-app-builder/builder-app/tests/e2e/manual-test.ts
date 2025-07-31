import { test, expect } from '@playwright/test';

test('manual UI exploration', async ({ page }) => {
  // Navigate to the home page
  await page.goto('/');
  
  // Take a screenshot of homepage
  await page.screenshot({ path: 'tests/screenshots/01-homepage.png', fullPage: true });
  
  console.log('Current URL:', page.url());
  console.log('Page title:', await page.title());
  
  // Try to navigate to dashboard
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot of dashboard/login
  await page.screenshot({ path: 'tests/screenshots/02-dashboard-or-login.png', fullPage: true });
  
  console.log('Dashboard URL:', page.url());
  
  // If it's the login page, let's explore it
  if (page.url().includes('/login')) {
    console.log('On login page - exploring authentication UI');
    
    // Look for login elements
    const loginElements = await page.locator('input, button, form').count();
    console.log(`Found ${loginElements} interactive elements on login page`);
    
    // Check page content
    const pageText = await page.textContent('body');
    console.log('Login page preview:', pageText?.substring(0, 200) + '...');
  }
  
  // Navigate back to homepage and explore structure
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Check the DOM structure
  const bodyContent = await page.innerHTML('body');
  console.log('Body structure preview:', bodyContent.substring(0, 500) + '...');
  
  // Look for main content areas
  const sections = await page.locator('div, section, main, article').count();
  console.log(`Found ${sections} content containers`);
  
  // Look for any text content
  const headings = page.locator('h1, h2, h3, h4, h5, h6');
  const headingCount = await headings.count();
  console.log(`Found ${headingCount} headings`);
  
  if (headingCount > 0) {
    for (let i = 0; i < Math.min(headingCount, 5); i++) {
      const heading = headings.nth(i);
      const text = await heading.textContent();
      console.log(`Heading ${i + 1}: "${text}"`);
    }
  }
  
  // Look for buttons and links
  const buttons = page.locator('button');
  const buttonCount = await buttons.count();
  console.log(`Found ${buttonCount} buttons`);
  
  if (buttonCount > 0) {
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      console.log(`Button ${i + 1}: "${text}"`);
    }
  }
  
  const links = page.locator('a');
  const linkCount = await links.count();
  console.log(`Found ${linkCount} links`);
  
  // Take final screenshot
  await page.screenshot({ path: 'tests/screenshots/03-final-exploration.png', fullPage: true });
  
  // The test always passes - we're just exploring
  expect(true).toBe(true);
});