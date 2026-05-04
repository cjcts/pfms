'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

const API = 'http://localhost:3099/api/expenses'

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function todayDDMMYYYY() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

test.describe('Expense Entry — form submit', () => {
  test.beforeAll(() => resetTestDb())

  test('adds an expense and shows success message + row in list', async ({ page }) => {
    await page.goto('/expenses')

    await page.getByPlaceholder('DD/MM/YYYY').fill(todayDDMMYYYY())
    await page.getByPlaceholder('What was this for?').fill('Costco')
    await page.locator('select[name="category"]').selectOption('Hypermarket')
    await page.getByPlaceholder('0.00').fill('87.50')

    await page.getByRole('button', { name: 'Add Expense' }).click()

    // Success message
    await expect(page.getByText('Expense added')).toBeVisible()

    // Row appears in list
    await expect(page.getByText('Costco')).toBeVisible()
    // Amount appears in both the row and the running total — use .first()
    await expect(page.getByText('$87.50').first()).toBeVisible()
  })

  test('resets form after add but keeps expense_type', async ({ page }) => {
    await page.goto('/expenses')
    // Select unpredictable type first
    await page.locator('select[name="expense_type"]').selectOption('unpredictable')

    await page.getByPlaceholder('DD/MM/YYYY').fill(todayDDMMYYYY())
    await page.getByPlaceholder('What was this for?').fill('Quick buy')
    await page.locator('select[name="category"]').selectOption('Purchases')
    await page.getByPlaceholder('0.00').fill('10.00')
    await page.getByRole('button', { name: 'Add Expense' }).click()

    await expect(page.getByText('Expense added')).toBeVisible()

    // Description field should be empty; type should be preserved
    await expect(page.getByPlaceholder('What was this for?')).toHaveValue('')
    await expect(page.locator('select[name="expense_type"]')).toHaveValue('unpredictable')
  })
})

test.describe('Expense Entry — validation', () => {
  test.beforeAll(() => resetTestDb())

  test('shows error when description is missing', async ({ page }) => {
    await page.goto('/expenses')
    await page.getByPlaceholder('DD/MM/YYYY').fill(todayDDMMYYYY())
    await page.locator('select[name="category"]').selectOption('Fuel')
    await page.getByPlaceholder('0.00').fill('50.00')
    await page.getByRole('button', { name: 'Add Expense' }).click()

    await expect(page.getByText('Description is required')).toBeVisible()
  })

  test('shows error when category is not selected', async ({ page }) => {
    await page.goto('/expenses')
    await page.getByPlaceholder('DD/MM/YYYY').fill(todayDDMMYYYY())
    await page.getByPlaceholder('What was this for?').fill('Test')
    await page.getByPlaceholder('0.00').fill('20.00')
    await page.getByRole('button', { name: 'Add Expense' }).click()

    await expect(page.getByText('Select a category')).toBeVisible()
  })

  test('shows error for invalid amount format', async ({ page }) => {
    await page.goto('/expenses')
    await page.getByPlaceholder('DD/MM/YYYY').fill(todayDDMMYYYY())
    await page.getByPlaceholder('What was this for?').fill('Test')
    await page.locator('select[name="category"]').selectOption('Fuel')
    await page.getByPlaceholder('0.00').fill('abc')
    await page.getByRole('button', { name: 'Add Expense' }).click()

    await expect(page.getByText('Enter a valid amount')).toBeVisible()
  })

  test('shows error when date is in the wrong month', async ({ page }) => {
    await page.goto('/expenses')
    // The month picker should default to current month; enter a date from a different month
    const wrongDate = '01/01/2020'
    await page.getByPlaceholder('DD/MM/YYYY').fill(wrongDate)
    await page.getByPlaceholder('What was this for?').fill('Test')
    await page.locator('select[name="category"]').selectOption('Fuel')
    await page.getByPlaceholder('0.00').fill('10.00')
    await page.getByRole('button', { name: 'Add Expense' }).click()

    await expect(page.getByText(/Must be a date in/)).toBeVisible()
  })
})

test.describe('Expense Entry — edit mode', () => {
  test.beforeAll(async () => {
    await resetTestDb()
  })

  test('clicking pencil icon enters edit mode with amber banner', async ({ page, request }) => {
    // Create an expense via API first
    const MONTH = currentMonthKey()
    const [y, m] = MONTH.split('-')
    await request.post(API, {
      data: { date: `${y}-${m}-15`, description: 'Edit target', category: 'Restaurants', amount: 25 }
    })

    await page.goto('/expenses')
    await expect(page.getByText('Edit target')).toBeVisible()

    // Click the pencil (Edit) button — use title attribute for reliable targeting
    await page.locator('[title="Edit"]').first().click()

    // Form should show "Edit Entry" heading and amber badge
    await expect(page.getByText('Edit Entry')).toBeVisible()
    await expect(page.getByText('Editing')).toBeVisible()
    await expect(page.getByPlaceholder('What was this for?')).toHaveValue('Edit target')
  })

  test('Cancel button exits edit mode', async ({ page, request }) => {
    const MONTH = currentMonthKey()
    const [y, m] = MONTH.split('-')
    await request.post(API, {
      data: { date: `${y}-${m}-16`, description: 'Cancel test', category: 'Fuel', amount: 40 }
    })

    await page.goto('/expenses')
    // Enter edit mode via the Edit (pencil) button
    await page.locator('[title="Edit"]').first().click()
    await expect(page.getByText('Edit Entry')).toBeVisible()

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('New Entry')).toBeVisible()
    await expect(page.getByText('Edit Entry')).not.toBeVisible()
  })
})

test.describe('Expense Entry — copy to form', () => {
  test.beforeAll(async () => {
    await resetTestDb()
  })

  test('copy icon populates the form with row data', async ({ page, request }) => {
    const MONTH = currentMonthKey()
    const [y, m] = MONTH.split('-')
    await request.post(API, {
      data: { date: `${y}-${m}-10`, description: 'Copyable', category: 'Haircut', amount: 30 }
    })

    await page.goto('/expenses')
    await expect(page.getByText('Copyable')).toBeVisible()

    // Click the Copy icon — use title attribute for reliable targeting
    await page.locator('[title="Copy to form"]').first().click()

    await expect(page.getByPlaceholder('What was this for?')).toHaveValue('Copyable')
    await expect(page.locator('select[name="category"]')).toHaveValue('Haircut')
    await expect(page.getByPlaceholder('0.00')).toHaveValue('30')
  })
})

test.describe('Expense Entry — month navigation', () => {
  test.beforeAll(() => resetTestDb())

  test('changing month reloads and shows correct label', async ({ page }) => {
    await page.goto('/expenses')

    const monthInput = page.locator('input[type="month"]')
    await monthInput.fill('2025-03')

    // The heading subtitle should update to March 2025 (.first() handles the subtitle + list header both showing the month)
    await expect(page.getByText(/March 2025/).first()).toBeVisible()
  })
})
