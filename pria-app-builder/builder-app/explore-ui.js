const { chromium } = require('playwright');

(async () => {
  console.log('Starting UI exploration...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate to the home page
    console.log('Navigating to homepage...');
    await page.goto('http://localhost:3007');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of homepage
    await page.screenshot({ path: 'tests/screenshots/homepage.png', fullPage: true });
    console.log('Homepage screenshot saved');
    
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Get page content structure
    const bodyText = await page.textContent('body');
    console.log('Page content preview:', bodyText?.substring(0, 300) + '...');
    
    // Look for main elements
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements => 
      elements.map(el => ({ tag: el.tagName, text: el.textContent }))
    );
    console.log('Headings found:', headings);
    
    const buttons = await page.$$eval('button', elements => 
      elements.map(el => el.textContent?.trim()).filter(text => text)
    );
    console.log('Buttons found:', buttons);
    
    const links = await page.$$eval('a', elements => 
      elements.map(el => ({ text: el.textContent?.trim(), href: el.href })).filter(item => item.text)
    );
    console.log('Links found:', links.slice(0, 5)); // First 5 links
    
    // Try navigating to dashboard
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3007/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of dashboard/login
    await page.screenshot({ path: 'tests/screenshots/dashboard.png', fullPage: true });
    console.log('Dashboard screenshot saved');
    
    console.log('Dashboard URL:', page.url());
    
    // Check if redirected to login
    if (page.url().includes('/login')) {
      console.log('Redirected to login - exploring authentication UI');
      
      const loginElements = await page.$$eval('input', elements => 
        elements.map(el => ({ type: el.type, placeholder: el.placeholder, name: el.name }))
      );
      console.log('Login form elements:', loginElements);
    } else {
      console.log('Dashboard accessible - exploring dashboard UI');
      
      // Look for tabs or navigation
      const tabs = await page.$$eval('[role="tab"], .tab', elements => 
        elements.map(el => el.textContent?.trim()).filter(text => text)
      );
      console.log('Tabs found:', tabs);
      
      // Look for main content areas
      const mainAreas = await page.$$eval('main, .main, [data-testid*="main"]', elements => 
        elements.map(el => el.className)
      );
      console.log('Main content areas:', mainAreas);
    }
    
    // Wait a bit for user to see the page
    console.log('Waiting 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Error during exploration:', error);
  } finally {
    await browser.close();
    console.log('UI exploration completed');
  }
})();