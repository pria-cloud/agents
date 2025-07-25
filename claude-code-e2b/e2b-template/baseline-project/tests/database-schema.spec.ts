import { test, expect } from '@playwright/test'

test.describe('Database Schema Designer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /developer/i }).click()
    await page.getByText('Database Schema').click()
  })

  test('should display database schema designer', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /database schema designer/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /add table/i })).toBeVisible()
    await expect(page.getByText('Tables')).toBeVisible()
  })

  test('should show existing tables', async ({ page }) => {
    // Check for example tables
    await expect(page.getByText('users')).toBeVisible()
    await expect(page.getByText('products')).toBeVisible()
    await expect(page.getByText('orders')).toBeVisible()
  })

  test('should display table relationships', async ({ page }) => {
    await expect(page.getByText('Relationships')).toBeVisible()
    
    // Check for relationship indicators
    await expect(page.getByText('users → orders')).toBeVisible()
    await expect(page.getByText('products → order_items')).toBeVisible()
  })

  test('should allow adding new table', async ({ page }) => {
    await page.getByRole('button', { name: /add table/i }).click()
    
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Create New Table')).toBeVisible()
    await expect(page.getByPlaceholder('Table name')).toBeVisible()
  })

  test('should show table details on click', async ({ page }) => {
    await page.getByText('users').click()
    
    // Should show table details
    await expect(page.getByText('Table: users')).toBeVisible()
    await expect(page.getByText('Columns')).toBeVisible()
    await expect(page.getByText('id')).toBeVisible()
    await expect(page.getByText('email')).toBeVisible()
  })

  test('should allow editing table schema', async ({ page }) => {
    await page.getByText('users').click()
    await page.getByRole('button', { name: /edit schema/i }).click()
    
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Edit Table Schema')).toBeVisible()
    await expect(page.getByRole('button', { name: /add column/i })).toBeVisible()
  })

  test('should generate migration scripts', async ({ page }) => {
    await page.getByRole('button', { name: /generate migration/i }).click()
    
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Generate Migration')).toBeVisible()
    await expect(page.getByText('CREATE TABLE')).toBeVisible()
  })

  test('should export schema', async ({ page }) => {
    await page.getByRole('button', { name: /export schema/i }).click()
    
    // Should show export options
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Export Database Schema')).toBeVisible()
    await expect(page.getByText('SQL')).toBeVisible()
    await expect(page.getByText('JSON')).toBeVisible()
  })
})