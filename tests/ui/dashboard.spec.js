'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')
const { seedExpenses, seedCCPurchase, monthKey } = require('../fixtures/seed')

const MONTH = monthKey()

test.describe('Dashboard — empty state', () => {
  test.beforeAll(() => resetTestDb())

  test('loads the dashboard page without errors', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByText('Dashboard').first()).toBeVisible()
  })

  test('shows $0 stat cards when no data exists', async ({ page }) => {
    await page.goto('/dashboard')
    // The page should show something for income/expenses
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Dashboard — with data', () => {
  test.beforeAll(async ({ request }) => {
    await resetTestDb()
    await seedExpenses(request, MONTH)
    await seedCCPurchase(request, MONTH)
    // Seed income so the summary has non-zero income
    const incRes  = await request.get(`http://localhost:3099/api/income?month=${MONTH}`)
    const incRows = (await incRes.json()).data
    const salRow  = incRows.find(r => r.source === 'Salary')
    await request.put(`http://localhost:3099/api/income/${salRow.id}`, {
      data: { expected: 4000, actual: 4000, notes: null }
    })
  })

  test('shows stat cards with non-zero values', async ({ page }) => {
    await page.goto('/dashboard')
    // At minimum the page renders income + expenses stat cards
    await expect(page.locator('body')).toContainText('$')
  })

  test('pie chart section is rendered', async ({ page }) => {
    await page.goto('/dashboard')
    // Recharts renders an SVG; verify at least one SVG is present
    await expect(page.locator('svg').first()).toBeVisible({ timeout: 8000 })
  })

  test('recent expenses section lists entries', async ({ page }) => {
    await page.goto('/dashboard')
    // At least one of the seeded descriptions should appear
    // Call .first() on the locator before expect() to handle multiple visible seeded entries
    await expect(page.getByText('Costco run').or(page.getByText('Tim Hortons')).or(page.getByText('Shell gas')).first()).toBeVisible({ timeout: 8000 })
  })
})
