'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

const SUMMARY_API  = 'http://localhost:3099/api/summary'
const EXP_API      = 'http://localhost:3099/api/expenses'
const CC_API       = 'http://localhost:3099/api/credit-card/purchases'
const INCOME_API   = 'http://localhost:3099/api/income'
const PRED_API     = 'http://localhost:3099/api/predictable'

const MONTH = '2025-07'
const DATE  = '2025-07-15'

test.describe('GET /api/summary', () => {
  test.beforeAll(() => resetTestDb())

  test('returns 400 when month is missing', async ({ request }) => {
    const res = await request.get(SUMMARY_API)
    expect(res.status()).toBe(400)
  })

  test('returns zeros for an empty month', async ({ request }) => {
    const res  = await request.get(`${SUMMARY_API}?month=${MONTH}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.totalExpenses).toBe(0)
    expect(body.data.totalIncome).toBe(0)
    expect(body.data.byCategory).toEqual([])
  })

  test('totals include daily expenses', async ({ request }) => {
    await request.post(EXP_API, {
      data: { date: DATE, description: 'Groceries', category: 'Hypermarket', amount: 100 }
    })
    const body = (await (await request.get(`${SUMMARY_API}?month=${MONTH}`)).json()).data
    expect(body.totalExpenses).toBe(100)
  })

  test('totals include CC purchases (my_share)', async ({ request }) => {
    await request.post(CC_API, {
      data: { date: DATE, description: 'Amazon', category: 'Purchases', amount: 80, my_share: 60 }
    })
    const body = (await (await request.get(`${SUMMARY_API}?month=${MONTH}`)).json()).data
    // 100 (expenses) + 60 (CC my_share)
    expect(body.totalExpenses).toBe(160)
  })

  test('byCategory merges expenses and CC for the same category', async ({ request }) => {
    // Add another Hypermarket CC purchase
    await request.post(CC_API, {
      data: { date: DATE, description: 'Costco CC', category: 'Hypermarket', amount: 50, my_share: 50 }
    })
    const body = (await (await request.get(`${SUMMARY_API}?month=${MONTH}`)).json()).data
    const hyper = body.byCategory.find(c => c.category === 'Hypermarket')
    expect(hyper.total).toBe(150) // 100 (expense) + 50 (CC)
  })

  test('income total reflects seeded actual values', async ({ request }) => {
    // Seed income and update Salary
    const incRows = (await (await request.get(`${INCOME_API}?month=${MONTH}`)).json()).data
    const salRow  = incRows.find(r => r.source === 'Salary')
    await request.put(`${INCOME_API}/${salRow.id}`, { data: { expected: 4000, actual: 4000, notes: null } })

    const body = (await (await request.get(`${SUMMARY_API}?month=${MONTH}`)).json()).data
    expect(body.totalIncome).toBe(4000)
  })

  test('balance = income - all expenses', async ({ request }) => {
    const body = (await (await request.get(`${SUMMARY_API}?month=${MONTH}`)).json()).data
    // income = 4000, totalExpenses = 210 (100 exp + 60 cc Purchases + 50 cc Hypermarket)
    expect(body.balance).toBeCloseTo(body.totalIncome - body.totalExpenses, 2)
  })
})

test.describe('GET /api/summary/history', () => {
  test.beforeAll(() => resetTestDb())

  test('returns 12 months by default', async ({ request }) => {
    const res  = await request.get(`${SUMMARY_API}/history`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(12)
  })

  test('returns correct count for months=3', async ({ request }) => {
    const body = (await (await request.get(`${SUMMARY_API}/history?months=3`)).json())
    expect(body.data).toHaveLength(3)
  })

  test('clamps months to maximum of 36', async ({ request }) => {
    const body = (await (await request.get(`${SUMMARY_API}/history?months=100`)).json())
    expect(body.data).toHaveLength(36)
  })

  test('clamps months to minimum of 1', async ({ request }) => {
    const body = (await (await request.get(`${SUMMARY_API}/history?months=0`)).json())
    expect(body.data).toHaveLength(1)
  })

  test('each entry has month, totalExpenses, totalIncome, balance', async ({ request }) => {
    const body = (await (await request.get(`${SUMMARY_API}/history?months=1`)).json())
    const entry = body.data[0]
    expect(entry).toHaveProperty('month')
    expect(entry).toHaveProperty('totalExpenses')
    expect(entry).toHaveProperty('totalIncome')
    expect(entry).toHaveProperty('balance')
  })

  test('months are in ascending order ending with the current month', async ({ request }) => {
    const body  = (await (await request.get(`${SUMMARY_API}/history?months=3`)).json())
    const months = body.data.map(e => e.month)
    expect(months[0] < months[1]).toBe(true)
    expect(months[1] < months[2]).toBe(true)
  })
})
