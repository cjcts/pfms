'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

const BASE = 'http://localhost:3099/api/credit-card'

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH     = currentMonthKey()
const DATE      = `${MONTH}-10`
const OLD_DATE  = '2024-01-05'
const OLD_MONTH = '2024-01'

test.describe('GET /api/credit-card', () => {
  test.beforeAll(() => resetTestDb())

  test('returns 400 when month is missing', async ({ request }) => {
    const res = await request.get(BASE)
    expect(res.status()).toBe(400)
  })

  test('returns empty purchases and payments for a new month', async ({ request }) => {
    const res  = await request.get(`${BASE}?month=${MONTH}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data.purchases).toEqual([])
    expect(body.data.payments).toEqual([])
  })
})

test.describe('POST /api/credit-card/purchases', () => {
  test.beforeAll(() => resetTestDb())

  test('creates a purchase and returns 201 with id', async ({ request }) => {
    const res = await request.post(`${BASE}/purchases`, {
      data: { date: DATE, description: 'Amazon', category: 'Purchases', amount: 49.99, my_share: 49.99 }
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBeGreaterThan(0)
  })

  test('stores purchase with null my_share when omitted', async ({ request }) => {
    await request.post(`${BASE}/purchases`, {
      data: { date: DATE, description: 'Shared item', category: 'Gifts', amount: 100 }
    })
    const list = await (await request.get(`${BASE}?month=${MONTH}`)).json()
    const row  = list.data.purchases.find(p => p.description === 'Shared item')
    expect(row.my_share).toBeNull()
  })

  test('returns 400 when required fields missing', async ({ request }) => {
    const res = await request.post(`${BASE}/purchases`, {
      data: { date: DATE, description: 'No amount', category: 'Purchases' }
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('DELETE /api/credit-card/purchases', () => {
  test.beforeAll(() => resetTestDb())

  test('deletes a recent purchase', async ({ request }) => {
    const post = await request.post(`${BASE}/purchases`, {
      data: { date: DATE, description: 'Delete me', category: 'Purchases', amount: 10 }
    })
    const { data: { id } } = await post.json()

    const del = await request.delete(`${BASE}/purchases/${id}`)
    expect(del.status()).toBe(200)

    const list = await (await request.get(`${BASE}?month=${MONTH}`)).json()
    expect(list.data.purchases.some(p => p.id === id)).toBe(false)
  })

  test('returns 403 for purchase older than 3 months', async ({ request }) => {
    const post = await request.post(`${BASE}/purchases`, {
      data: { date: OLD_DATE, description: 'Old purchase', category: 'Purchases', amount: 20 }
    })
    const { data: { id } } = await post.json()

    const del = await request.delete(`${BASE}/purchases/${id}`)
    expect(del.status()).toBe(403)
    expect((await del.json()).error).toContain(OLD_MONTH)
  })

  test('returns 404 for non-existent purchase', async ({ request }) => {
    expect((await request.delete(`${BASE}/purchases/999999`)).status()).toBe(404)
  })
})

test.describe('POST /api/credit-card/payments', () => {
  test.beforeAll(() => resetTestDb())

  test('creates a payment and returns 201', async ({ request }) => {
    const res = await request.post(`${BASE}/payments`, {
      data: { date: DATE, amount: 500, notes: 'Monthly payment' }
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBeGreaterThan(0)
  })

  test('appears in GET response for the month', async ({ request }) => {
    const list = await (await request.get(`${BASE}?month=${MONTH}`)).json()
    const pay  = list.data.payments.find(p => p.notes === 'Monthly payment')
    expect(pay).toBeTruthy()
    expect(pay.amount).toBe(500)
  })

  test('returns 400 when date or amount missing', async ({ request }) => {
    const res = await request.post(`${BASE}/payments`, { data: { notes: 'Missing fields' } })
    expect(res.status()).toBe(400)
  })
})

test.describe('DELETE /api/credit-card/payments', () => {
  test.beforeAll(() => resetTestDb())

  test('returns 403 for old payment', async ({ request }) => {
    const post = await request.post(`${BASE}/payments`, {
      data: { date: OLD_DATE, amount: 200 }
    })
    const { data: { id } } = await post.json()

    const del = await request.delete(`${BASE}/payments/${id}`)
    expect(del.status()).toBe(403)
  })

  test('deletes a recent payment', async ({ request }) => {
    const post = await request.post(`${BASE}/payments`, {
      data: { date: DATE, amount: 50 }
    })
    const { data: { id } } = await post.json()
    expect((await request.delete(`${BASE}/payments/${id}`)).status()).toBe(200)
  })
})
