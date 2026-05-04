'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

test.describe('Owed & Owing page', () => {
  test.beforeAll(() => resetTestDb())

  test('loads the page', async ({ page }) => {
    await page.goto('/owed-owing')
    await expect(page).toHaveURL('/owed-owing')
    // nav says "Owed & Owing", h1 says "Owed & Owing" — use .first()
    await expect(page.getByText(/Owed/i).first()).toBeVisible()
  })

  test('shows I Owe and Owed to Me sections', async ({ page }) => {
    await page.goto('/owed-owing')
    await expect(page.getByText(/I Owe/i).first()).toBeVisible()
    // "Owed to Me" appears in both stat card and section heading — use .first()
    await expect(page.getByText(/Owed to Me/i).first()).toBeVisible()
  })

  test('adds a to_give record and shows it in I Owe list', async ({ page }) => {
    await page.goto('/owed-owing')

    // Form is COLLAPSED by default — click the "Add Entry" toggle button to open it
    await page.getByRole('button', { name: 'Add Entry' }).first().click()

    // Direction defaults to 'to_give' (I Owe Someone) — no need to click anything
    // Person field placeholder is "Name"
    await page.getByPlaceholder('Name').fill('Alice')
    // Amount placeholder is "0.00"
    await page.getByPlaceholder('0.00').fill('150')

    // Submit — the form's submit button (type="submit") says "Add Entry"
    // Use locator for submit type to disambiguate from the toggle button
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Alice')).toBeVisible({ timeout: 5000 })
  })

  test('adds a to_get record and shows it in Owed to Me list', async ({ page }) => {
    await page.goto('/owed-owing')

    // Open the form
    await page.getByRole('button', { name: 'Add Entry' }).first().click()

    // Direction: click "Someone Owes Me" toggle button to select to_get
    await page.getByRole('button', { name: 'Someone Owes Me' }).click()

    await page.getByPlaceholder('Name').fill('Bob')
    await page.getByPlaceholder('0.00').fill('75')

    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Bob')).toBeVisible({ timeout: 5000 })
  })
})
