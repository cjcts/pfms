'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

const API        = 'http://localhost:3099/api/budget'
const MONTH      = '2025-03'
const EXP_API    = 'http://localhost:3099/api/expenses'
const CC_API     = 'http://localhost:3099/api/credit-card/purchases'

test.describe('GET /api/budget', () => {
  test.beforeAll(() => resetTestDb())

  test('returns 400 when month is missing', async ({ request }) => {
    const res  = await request.get(API)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  test('returns all 29 categories with target=0 and actual=0 when nothing is set', async ({ request }) => {
    const res  = await request.get(`${API}?month=${MONTH}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(29)
    expect(body.data.every(r => r.target === 0 && r.actual === 0)).toBe(true)
  })

  test('reflects actual spending from expenses', async ({ request }) => {
    await request.post(EXP_API, {
      data: { date: `${MONTH}-10`, description: 'Superstore', category: 'Hypermarket', amount: 120 }
    })
    const body = (await (await request.get(`${API}?month=${MONTH}`)).json())
    const row  = body.data.find(r => r.category === 'Hypermarket')
    expect(row.actual).toBe(120)
  })

  test('merges CC purchases into actual for the same category', async ({ request }) => {
    await request.post(CC_API, {
      data: { date: `${MONTH}-12`, description: 'Amazon', category: 'Hypermarket', amount: 50, my_share: 50 }
    })
    const body = (await (await request.get(`${API}?month=${MONTH}`)).json())
    const row  = body.data.find(r => r.category === 'Hypermarket')
    expect(row.actual).toBe(170) // 120 + 50
  })

  test('active categories sort before inactive ones', async ({ request }) => {
    const body = (await (await request.get(`${API}?month=${MONTH}`)).json())
    const firstRow = body.data[0]
    expect(firstRow.actual).toBeGreaterThan(0)
  })
})

test.describe('PUT /api/budget', () => {
  test.beforeAll(() => resetTestDb())

  test('upserts a budget target', async ({ request }) => {
    const res = await request.put(API, {
      data: { month_key: MONTH, category: 'Restaurants', target: 500 }
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).success).toBe(true)

    const body = (await (await request.get(`${API}?month=${MONTH}`)).json())
    const row  = body.data.find(r => r.category === 'Restaurants')
    expect(row.target).toBe(500)
  })

  test('updates (replaces) an existing target', async ({ request }) => {
    await request.put(API, { data: { month_key: MONTH, category: 'Restaurants', target: 600 } })
    const body = (await (await request.get(`${API}?month=${MONTH}`)).json())
    const row  = body.data.find(r => r.category === 'Restaurants')
    expect(row.target).toBe(600)
  })

  test('returns 400 for negative target', async ({ request }) => {
    const res = await request.put(API, {
      data: { month_key: MONTH, category: 'Fuel', target: -1 }
    })
    expect(res.status()).toBe(400)
  })

  test('returns 400 for unknown category', async ({ request }) => {
    const res = await request.put(API, {
      data: { month_key: MONTH, category: 'InvalidCat', target: 100 }
    })
    expect(res.status()).toBe(400)
  })

  test('returns 400 when required fields are missing', async ({ request }) => {
    const res = await request.put(API, { data: { month_key: MONTH, category: 'Fuel' } })
    expect(res.status()).toBe(400)
  })
})
