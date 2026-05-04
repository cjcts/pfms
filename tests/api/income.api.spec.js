'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

const API = 'http://localhost:3099/api/income'

// Use isolated month keys well in the past to avoid real-data interference
const PRIOR_MONTH = '2023-06'
const TEST_MONTH  = '2023-07'

test.describe('GET /api/income — missing param', () => {
  test.beforeAll(() => resetTestDb())

  test('returns 400 when month is missing', async ({ request }) => {
    const res  = await request.get(API)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/month/)
  })
})

test.describe('GET /api/income — auto-seeding', () => {
  test.beforeAll(() => resetTestDb())

  test('seeds 8 default income sources on first access', async ({ request }) => {
    const res  = await request.get(`${API}?month=${TEST_MONTH}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(8)

    const sources = body.data.map(r => r.source)
    expect(sources).toContain('Opening Balance')
    expect(sources).toContain('Salary')
    expect(sources).toContain('CRA')
  })

  test('returns the same rows on second access (no duplicates)', async ({ request }) => {
    const res  = await request.get(`${API}?month=${TEST_MONTH}`)
    const body = await res.json()
    expect(body.data).toHaveLength(8)
  })
})

test.describe('GET /api/income — opening balance carry', () => {
  test.beforeAll(async () => {
    resetTestDb()
  })

  test('carries prior month closing balance into Opening Balance', async ({ request }) => {
    // Step 1: seed prior month income
    // Access prior month to create its rows
    const priorRes  = await request.get(`${API}?month=${PRIOR_MONTH}`)
    const priorRows = (await priorRes.json()).data

    // Update Salary actual to 5000 and Opening Balance actual to 1000
    const obRow  = priorRows.find(r => r.source === 'Opening Balance')
    const salRow = priorRows.find(r => r.source === 'Salary')
    await request.put(`${API}/${obRow.id}`,  { data: { expected: 1000, actual: 1000, notes: null } })
    await request.put(`${API}/${salRow.id}`, { data: { expected: 5000, actual: 5000, notes: null } })

    // Step 2: seed expenses for prior month: 2000
    await request.post('http://localhost:3099/api/expenses', {
      data: { date: `${PRIOR_MONTH}-15`, description: 'Rent', category: 'House Rental', amount: 2000 }
    })

    // Expected closing: 1000 (OB) + 5000 (salary) - 2000 (expenses) = 4000
    const expectedOB = 4000

    // Step 3: access test month — triggers seeding with carry
    const testRes  = await request.get(`${API}?month=${TEST_MONTH}`)
    const testRows = (await testRes.json()).data
    const testOB   = testRows.find(r => r.source === 'Opening Balance')

    expect(testOB.actual).toBe(expectedOB)
    expect(testOB.expected).toBe(expectedOB)
  })
})

test.describe('PUT /api/income/:id', () => {
  test.beforeAll(() => resetTestDb())

  test('updates expected, actual and notes', async ({ request }) => {
    const rows = (await (await request.get(`${API}?month=${TEST_MONTH}`)).json()).data
    const row  = rows.find(r => r.source === 'Salary')

    const res = await request.put(`${API}/${row.id}`, {
      data: { expected: 6000, actual: 5800, notes: 'bonus month' }
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).success).toBe(true)

    // Verify by re-fetching
    const updated = (await (await request.get(`${API}?month=${TEST_MONTH}`)).json()).data
    const updatedRow = updated.find(r => r.id === row.id)
    expect(updatedRow.expected).toBe(6000)
    expect(updatedRow.actual).toBe(5800)
    expect(updatedRow.notes).toBe('bonus month')
  })
})
