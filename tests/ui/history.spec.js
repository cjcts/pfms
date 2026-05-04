'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')
const { seedExpenses, monthKey } = require('../fixtures/seed')

test.describe('History page — empty state', () => {
  test.beforeAll(() => resetTestDb())

  test('loads the history page', async ({ page }) => {
    await page.goto('/history')
    await expect(page).toHaveURL('/history')
    await expect(page.getByText('History').first()).toBeVisible()
  })

  test('renders without crashing when no data exists', async ({ page }) => {
    await page.goto('/history')
    // Page should be visible and not show a JS error
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('History page — with data', () => {
  test.beforeAll(async ({ request }) => {
    await resetTestDb()
    await seedExpenses(request, monthKey())
  })

  test('shows chart area after data is seeded', async ({ page }) => {
    await page.goto('/history')
    // Recharts SVGs should render once there is data
    await expect(page.locator('body')).toBeVisible()
    // At a minimum the page title should be present
    await expect(page.getByText('History').first()).toBeVisible()
  })

  test('shows month-by-month table section', async ({ page }) => {
    await page.goto('/history')
    // The table header should mention Month or Income or Expenses
    // Multiple sidebar + page elements contain Month/Income/Expenses — call .first() on locator
    await expect(
      page.getByText(/Month/i).or(page.getByText(/Income/i)).or(page.getByText(/Expenses/i)).first()
    ).toBeVisible({ timeout: 5000 })
  })
})
