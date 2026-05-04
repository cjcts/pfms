'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

function todayDDMMYYYY() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

test.describe('Home Expenses page', () => {
  test.beforeAll(() => resetTestDb())

  test('loads the home expenses page', async ({ page }) => {
    await page.goto('/home')
    await expect(page).toHaveURL('/home')
    // nav label "Home Expenses" and h1 "Home Expenses" — use .first()
    await expect(page.getByText('Home Expenses').first()).toBeVisible()
  })

  test('shows the entry form with amount CAD and INR fields', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByText(/CAD/i).first()).toBeVisible()
    await expect(page.getByText(/INR/i).first()).toBeVisible()
  })

  test('adds a home expense entry', async ({ page }) => {
    await page.goto('/home')

    // Date placeholder is "DD/MM/YYYY"
    await page.getByPlaceholder('DD/MM/YYYY').fill(todayDDMMYYYY())

    // Recipient placeholder is "e.g. Parents" (not "Recipient")
    await page.getByPlaceholder('e.g. Parents').fill('Parents')

    // Both amount_cad and amount_inr inputs use placeholder "0.00"
    // amount_cad is first, amount_inr is second
    await page.getByPlaceholder('0.00').first().fill('500')
    await page.getByPlaceholder('0.00').nth(1).fill('31000')

    // Submit button text is "Add" (with PlusCircle icon)
    await page.getByRole('button', { name: 'Add' }).click()

    await expect(page.getByText('Parents')).toBeVisible({ timeout: 5000 })
  })
})
