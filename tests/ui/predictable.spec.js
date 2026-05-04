'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

test.describe('Fixed (Predictable) Expenses page', () => {
  test.beforeAll(() => resetTestDb())

  test('loads the page', async ({ page }) => {
    await page.goto('/predictable')
    await expect(page).toHaveURL('/predictable')
    await expect(page.getByText(/Fixed Expenses/i).first()).toBeVisible()
  })

  test('shows auto-seeded categories after first load', async ({ page }) => {
    await page.goto('/predictable')
    // These two should always be in the seeded default list
    await expect(page.getByText('House Rental')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Insurances')).toBeVisible()
  })

  test('shows month picker', async ({ page }) => {
    await page.goto('/predictable')
    await expect(page.locator('input[type="month"]')).toBeVisible()
  })
})
