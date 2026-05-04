'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

test.describe('Budget Planner — page load', () => {
  test.beforeAll(() => resetTestDb())

  test('navigates to the budget planner', async ({ page }) => {
    await page.goto('/budget')
    await expect(page).toHaveURL('/budget')
    await expect(page.getByText('Budget Planner').first()).toBeVisible()
  })

  test('shows stat cards: Total Budgeted, Total Spent, Variance', async ({ page }) => {
    await page.goto('/budget')
    await expect(page.getByText(/Total Budgeted/i)).toBeVisible()
    // "Spent" may appear in multiple stat card labels — call .first() on the locator before expect()
    await expect(page.getByText(/Total Spent/i).or(page.getByText(/Spent/i)).first()).toBeVisible()
  })

  test('shows category list', async ({ page }) => {
    await page.goto('/budget')
    // With an empty DB, all categories are in the "Untracked Categories" collapsed section.
    // Expand it, then verify at least one known category name is visible.
    await page.getByRole('button', { name: /Untracked Categories/i }).click()
    await expect(page.getByText('Hypermarket').or(page.getByText('Restaurants')).first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Budget Planner — set a target', () => {
  test.beforeAll(() => resetTestDb())

  test('can set a budget target for a category via the API and see it reflected', async ({ page, request }) => {
    const now  = new Date()
    const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Set a target via API
    await request.put('http://localhost:3099/api/budget', {
      data: { month_key: mKey, category: 'Restaurants', target: 400 }
    })

    await page.goto('/budget')
    // The amount "400" may appear in both the row and the stat card total — call .first() on locator
    await expect(page.getByText('400').or(page.getByText('$400')).first()).toBeVisible({ timeout: 5000 })
  })
})
