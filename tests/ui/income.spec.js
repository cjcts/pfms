'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

test.describe('Income page', () => {
  test.beforeAll(() => resetTestDb())

  test('loads the income page', async ({ page }) => {
    await page.goto('/income')
    await expect(page).toHaveURL('/income')
    await expect(page.getByText('Income').first()).toBeVisible()
  })

  test('shows default income sources after auto-seeding', async ({ page }) => {
    await page.goto('/income')
    // Auto-seeding triggers on page load; these sources should appear
    await expect(page.getByText('Opening Balance')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Salary')).toBeVisible()
  })

  test('shows month picker', async ({ page }) => {
    await page.goto('/income')
    await expect(page.locator('input[type="month"]')).toBeVisible()
  })
})
