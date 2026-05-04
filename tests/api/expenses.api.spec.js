'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb, insertRow } = require('../fixtures/db-reset')

const API = 'http://localhost:3099/api/expenses'

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH     = currentMonthKey()
const [CY, CM]  = MONTH.split('-')
const DATE      = `${CY}-${CM}-15`
const OLD_MONTH = '2024-01'
const OLD_DATE  = '2024-01-10'

test.describe('GET /api/expenses', () => {
  test.beforeAll(() => resetTestDb())

  test('returns 400 when month param is missing', async ({ request }) => {
    const res  = await request.get(API)
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/month/)
  })

  test('returns empty array for a month with no data', async ({ request }) => {
    const res  = await request.get(`${API}?month=${MONTH}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })
})

test.describe('POST /api/expenses', () => {
  test.beforeAll(() => resetTestDb())

  test('creates an expense and returns 201 with id', async ({ request }) => {
    const res = await request.post(API, {
      data: { date: DATE, description: 'Costco', category: 'Hypermarket', amount: 87.50 }
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(typeof body.data.id).toBe('number')
    expect(body.data.id).toBeGreaterThan(0)
  })

  test('defaults expense_type to daily', async ({ request }) => {
    await request.post(API, {
      data: { date: DATE, description: 'Coffee', category: 'Restaurants', amount: 5.50 }
    })
    const list = await (await request.get(`${API}?month=${MONTH}`)).json()
    const row  = list.data.find(e => e.description === 'Coffee')
    expect(row.expense_type).toBe('daily')
  })

  test('stores notes when provided', async ({ request }) => {
    await request.post(API, {
      data: { date: DATE, description: 'With note', category: 'Miscellaneous', amount: 10, notes: 'test note' }
    })
    const list = await (await request.get(`${API}?month=${MONTH}`)).json()
    const row  = list.data.find(e => e.description === 'With note')
    expect(row.notes).toBe('test note')
  })

  test('returns 400 when required fields are missing', async ({ request }) => {
    const res = await request.post(API, { data: { date: DATE, description: 'Incomplete' } })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })
})

test.describe('GET /api/expenses (populated)', () => {
  test.beforeAll(async () => {
    await resetTestDb()
  })

  test('returns expenses for the correct month only', async ({ request }) => {
    // Insert two months
    await request.post(API, { data: { date: DATE,       description: 'This month', category: 'Fuel',      amount: 50 } })
    await request.post(API, { data: { date: OLD_DATE,   description: 'Old month',  category: 'Purchases', amount: 30 } })

    const res  = await request.get(`${API}?month=${MONTH}`)
    const body = await res.json()
    // The route returns date but not month_key; verify via date prefix instead
    expect(body.data.every(e => e.date.startsWith(MONTH))).toBe(true)
    expect(body.data.some(e => e.description === 'This month')).toBe(true)
    expect(body.data.some(e => e.description === 'Old month')).toBe(false)
  })
})

test.describe('PUT /api/expenses/:id', () => {
  test.beforeAll(() => resetTestDb())

  test('updates all fields', async ({ request }) => {
    const post = await request.post(API, {
      data: { date: DATE, description: 'Original', category: 'Fuel', amount: 40 }
    })
    const { data: { id } } = await post.json()

    const put = await request.put(`${API}/${id}`, {
      data: {
        date:         DATE,
        description:  'Updated',
        category:     'Restaurants',
        amount:       99.99,
        expense_type: 'unpredictable',
        notes:        'edited',
      }
    })
    expect(put.status()).toBe(200)
    expect((await put.json()).success).toBe(true)

    const list = await (await request.get(`${API}?month=${MONTH}`)).json()
    const row  = list.data.find(e => e.id === id)
    expect(row.description).toBe('Updated')
    expect(row.category).toBe('Restaurants')
    expect(row.amount).toBe(99.99)
    expect(row.expense_type).toBe('unpredictable')
    expect(row.notes).toBe('edited')
  })
})

test.describe('DELETE /api/expenses/:id', () => {
  test.beforeAll(() => resetTestDb())

  test('deletes a recent record successfully', async ({ request }) => {
    const post = await request.post(API, {
      data: { date: DATE, description: 'To delete', category: 'Miscellaneous', amount: 1 }
    })
    const { data: { id } } = await post.json()

    const del = await request.delete(`${API}/${id}`)
    expect(del.status()).toBe(200)

    const list = await (await request.get(`${API}?month=${MONTH}`)).json()
    expect(list.data.some(e => e.id === id)).toBe(false)
  })

  test('returns 403 for a record older than 3 months', async ({ request }) => {
    // Insert old record directly (API would create it, but date drives month_key)
    const post = await request.post(API, {
      data: { date: OLD_DATE, description: 'Old record', category: 'Fuel', amount: 20 }
    })
    const { data: { id } } = await post.json()

    const del = await request.delete(`${API}/${id}`)
    expect(del.status()).toBe(403)
    const body = await del.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain(OLD_MONTH)
  })

  test('returns 404 for a non-existent id', async ({ request }) => {
    const res = await request.delete(`${API}/999999`)
    expect(res.status()).toBe(404)
  })
})

test.describe('GET /api/expenses/descriptions', () => {
  test.beforeAll(async () => {
    resetTestDb()
  })

  test('returns unique descriptions ordered by frequency', async ({ request }) => {
    // Add "Costco" twice and "Shell" once
    for (let i = 0; i < 2; i++) {
      await request.post(API, { data: { date: DATE, description: 'Costco', category: 'Hypermarket', amount: 100 } })
    }
    await request.post(API, { data: { date: DATE, description: 'Shell', category: 'Fuel', amount: 50 } })

    const res  = await request.get('http://localhost:3099/api/expenses/descriptions')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    // Costco should appear before Shell (higher frequency)
    const costcoIdx = body.data.indexOf('Costco')
    const shellIdx  = body.data.indexOf('Shell')
    expect(costcoIdx).toBeGreaterThanOrEqual(0)
    expect(shellIdx).toBeGreaterThanOrEqual(0)
    expect(costcoIdx).toBeLessThan(shellIdx)
    // No duplicates
    expect(body.data.filter(d => d === 'Costco').length).toBe(1)
  })
})
