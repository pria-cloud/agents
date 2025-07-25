import { test, expect } from '@playwright/test'

test.describe('API Endpoints', () => {
  test('should have API documentation available', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /developer/i }).click()
    await page.getByText('API Documentation').click()
    
    await expect(page.getByRole('heading', { name: /api documentation/i })).toBeVisible()
    await expect(page.getByText('API Endpoints')).toBeVisible()
  })

  test('should display endpoint categories', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /developer/i }).click()
    await page.getByText('API Documentation').click()
    
    // Check for endpoint categories
    await expect(page.getByText('User Management')).toBeVisible()
    await expect(page.getByText('Product Catalog')).toBeVisible()
    await expect(page.getByText('Order Processing')).toBeVisible()
  })

  test('should expand endpoint details', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /developer/i }).click()
    await page.getByText('API Documentation').click()
    
    // Click on an endpoint
    await page.getByText('GET /api/users').click()
    
    // Should show endpoint details
    await expect(page.getByText('Response Schema')).toBeVisible()
    await expect(page.getByText('Parameters')).toBeVisible()
  })

  test('should allow testing endpoints', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /developer/i }).click()
    await page.getByText('API Documentation').click()
    
    // Click test button for an endpoint
    await page.getByRole('button', { name: /test api/i }).first().click()
    
    // Should show test interface
    await expect(page.getByText('API Test Console')).toBeVisible()
    await expect(page.getByRole('button', { name: /send request/i })).toBeVisible()
  })

  test('should display response examples', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /developer/i }).click()
    await page.getByText('API Documentation').click()
    
    // Look for response examples
    await expect(page.getByText('200 OK')).toBeVisible()
    await expect(page.getByText('400 Bad Request')).toBeVisible()
    await expect(page.getByText('500 Internal Server Error')).toBeVisible()
  })

  test('should filter endpoints by category', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /developer/i }).click()
    await page.getByText('API Documentation').click()
    
    // Filter by category
    const categoryFilter = page.locator('select').first()
    await categoryFilter.selectOption('User Management')
    
    // Should show only user management endpoints
    await expect(page.getByText('GET /api/users')).toBeVisible()
    await expect(page.getByText('POST /api/users')).toBeVisible()
  })
})