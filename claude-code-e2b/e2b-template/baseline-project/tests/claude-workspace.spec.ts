import { test, expect } from '@playwright/test'

test.describe('Claude Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load the workspace interface', async ({ page }) => {
    await expect(page).toHaveTitle(/Claude Code E2B/i)
    
    // Check for the main workspace elements
    await expect(page.getByRole('heading', { name: /claude workspace/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /business/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /developer/i })).toBeVisible()
  })

  test('should switch between business and developer modes', async ({ page }) => {
    // Start in business mode
    await expect(page.getByRole('button', { name: /business/i })).toHaveClass(/default/)
    
    // Switch to developer mode
    await page.getByRole('button', { name: /developer/i }).click()
    await expect(page.getByRole('button', { name: /developer/i })).toHaveClass(/default/)
    
    // Check for developer-specific features
    await expect(page.getByText('Code Editor')).toBeVisible()
    await expect(page.getByText('Terminal')).toBeVisible()
    await expect(page.getByText('Git Integration')).toBeVisible()
  })

  test('should navigate between different views', async ({ page }) => {
    // Test requirements view
    await page.getByText('Requirements').click()
    await expect(page.getByRole('heading', { name: /requirements.*user stories/i })).toBeVisible()
    
    // Test workflow designer
    await page.getByText('Workflow Designer').click()
    await expect(page.getByRole('heading', { name: /workflow designer/i })).toBeVisible()
    
    // Test technical specifications
    await page.getByText('Technical Specs').click()
    await expect(page.getByRole('heading', { name: /technical specifications/i })).toBeVisible()
  })

  test('should display session information', async ({ page }) => {
    // Check for session selector
    await expect(page.getByText('E-commerce Platform')).toBeVisible()
    
    // Check connection status
    await expect(page.getByText(/connected|disconnected/i)).toBeVisible()
  })

  test('should open session management dialog', async ({ page }) => {
    await page.getByText('E-commerce Platform').click()
    await page.getByRole('button', { name: /new session/i }).click()
    
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Create New Session')).toBeVisible()
  })
})

test.describe('Developer Mode Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /developer/i }).click()
  })

  test('should access code editor', async ({ page }) => {
    await page.getByText('Code Editor').click()
    await expect(page.getByRole('heading', { name: /code editor/i })).toBeVisible()
    await expect(page.getByText('File Explorer')).toBeVisible()
  })

  test('should access terminal', async ({ page }) => {
    await page.getByText('Terminal').click()
    await expect(page.getByRole('heading', { name: /terminal/i })).toBeVisible()
    await expect(page.getByText('Recent Deployments')).toBeVisible({ timeout: 10000 })
  })

  test('should access database schema designer', async ({ page }) => {
    await page.getByText('Database Schema').click()
    await expect(page.getByRole('heading', { name: /database schema designer/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /add table/i })).toBeVisible()
  })

  test('should access API documentation', async ({ page }) => {
    await page.getByText('API Documentation').click()
    await expect(page.getByRole('heading', { name: /api documentation/i })).toBeVisible()
    await expect(page.getByText('API Endpoints')).toBeVisible()
  })

  test('should access build & deploy', async ({ page }) => {
    await page.getByText('Build & Deploy').click()
    await expect(page.getByRole('heading', { name: /build.*deploy/i })).toBeVisible()
    await expect(page.getByText('Recent Deployments')).toBeVisible()
  })
})