import { test, expect } from '@playwright/test'

test.describe('Build & Deploy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /developer/i }).click()
    await page.getByText('Build & Deploy').click()
  })

  test('should display deployment interface', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /build.*deploy/i })).toBeVisible()
    await expect(page.getByText('Recent Deployments')).toBeVisible()
    await expect(page.getByRole('button', { name: /deploy to staging/i })).toBeVisible()
  })

  test('should show build status', async ({ page }) => {
    await expect(page.getByText('Build Status')).toBeVisible()
    await expect(page.getByText(/ready|building|failed/i)).toBeVisible()
  })

  test('should display deployment history', async ({ page }) => {
    await expect(page.getByText('Deployment History')).toBeVisible()
    
    // Check for deployment entries
    await expect(page.getByText('Production')).toBeVisible()
    await expect(page.getByText('Staging')).toBeVisible()
    await expect(page.getByText(/deployed|building|failed/i)).toBeVisible()
  })

  test('should start build process', async ({ page }) => {
    await page.getByRole('button', { name: /build project/i }).click()
    
    // Should show building state
    await expect(page.getByText(/building.*project/i)).toBeVisible()
    
    // Mock build completion after timeout
    await page.waitForTimeout(3000)
    await expect(page.getByText(/build.*complete|build.*failed/i)).toBeVisible()
  })

  test('should deploy to staging', async ({ page }) => {
    await page.getByRole('button', { name: /deploy to staging/i }).click()
    
    // Should show deployment progress
    await expect(page.getByText(/deploying.*staging/i)).toBeVisible()
    
    // Wait for deployment to complete (mocked)
    await page.waitForTimeout(4000)
    await expect(page.getByText(/deployment.*complete|deployment.*failed/i)).toBeVisible()
  })

  test('should show environment variables management', async ({ page }) => {
    await expect(page.getByText('Environment Variables')).toBeVisible()
    await expect(page.getByRole('button', { name: /manage env vars/i })).toBeVisible()
  })

  test('should display deployment logs', async ({ page }) => {
    await page.getByText('View Logs').first().click()
    
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Deployment Logs')).toBeVisible()
    await expect(page.getByText(/building|deploying|npm install/i)).toBeVisible()
  })

  test('should show deployment metrics', async ({ page }) => {
    await expect(page.getByText('Performance Metrics')).toBeVisible()
    await expect(page.getByText('Build Time')).toBeVisible()
    await expect(page.getByText('Bundle Size')).toBeVisible()
    await expect(page.getByText(/\d+\.\d+s|\d+\.\d+ MB/)).toBeVisible()
  })

  test('should allow rollback to previous version', async ({ page }) => {
    await page.getByRole('button', { name: /rollback/i }).first().click()
    
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('Confirm Rollback')).toBeVisible()
    await expect(page.getByRole('button', { name: /confirm rollback/i })).toBeVisible()
  })
})