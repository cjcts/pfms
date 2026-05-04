'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

function todayDDMMYYYY() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

test.describe('Credit Card page', () => {
  test.beforeAll(() => resetTestDb())

  test('loads the credit card page', async ({ page }) => {
    await page.goto('/credit-card')
    await expect(page).toHaveURL('/credit-card')
    // Use .first() to avoid strict-mode error when nav + h1 both contain "Credit Card"
    await expect(page.getByText('Credit Card').first()).toBeVisible()
  })

  test('shows purchases and payments sections', async ({ page }) => {
    await page.goto('/credit-card')
    await expect(page.getByText(/Purchases/i).first()).toBeVisible()
    await expect(page.getByText(/Payments/i).first()).toBeVisible()
  })

  test('adds a purchase via the form', async ({ page }) => {
    await page.goto('/credit-card')

    // Date placeholder is today's date (dynamic), not the string "DD/MM/YYYY"
    // Target the first text input in the page (purchase form date)
    await page.locator('input[type="text"]').first().fill(todayDDMMYYYY())

    // Description placeholder in PurchaseForm is "e.g. Amazon order"
    await page.getByPlaceholder('e.g. Amazon order').fill('Netflix subscription')

    // Category select has no name attribute — use first select on page
    await page.locator('select').first().selectOption('Subscriptions')

    // Amount placeholder is "0.00"; first match is the purchase amount
    await page.getByPlaceholder('0.00').first().fill('18.99')

    // Submit button in PurchaseForm says "Add Purchase"
    await page.getByRole('button', { name: 'Add Purchase' }).click()

    await expect(page.getByText('Netflix subscription')).toBeVisible({ timeout: 5000 })
  })
})
