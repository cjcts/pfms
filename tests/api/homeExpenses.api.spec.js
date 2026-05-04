'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

const API = 'http://localhost:3099/api/home-expenses'

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH     = currentMonthKey()
const DATE      = `${MONTH}-20`
const OLD_DATE  = '2024-01-05'
const OLD_MONTH = '2024-01'

test.describe('GET /api/home-expenses', () => {
  test.beforeAll(() => resetTestDb())

  test('returns 400 when month is missing', async ({ request }) => {
    const res = await request.get(API)
    expect(res.status()).toBe(400)
  })

  test('returns empty array for new month', async ({ request }) => {
    const res  = await request.get(`${API}?month=${MONTH}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

test.describe('POST /api/home-expenses', () => {
  test.beforeAll(() => resetTestDb())

  test('creates a home expense with all fields', async ({ request }) => {
    const res = await request.post(API, {
      data: {
        date: DATE, recipient: 'Parents', amount_cad: 500,
        amount_inr: 31000, notes: 'Monthly remittance'
      }
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBeGreaterThan(0)
  })

  test('stored record appears in GET', async ({ request }) => {
    const list = await (await request.get(`${API}?month=${MONTH}`)).json()
    const row  = list.data.find(r => r.recipient === 'Parents')
    expect(row.amount_cad).toBe(500)
    expect(row.amount_inr).toBe(31000)
    expect(row.notes).toBe('Monthly remittance')
  })

  test('creates without optional fields', async ({ request }) => {
    const res = await request.post(API, {
      data: { date: DATE, recipient: 'Sibling', amount_cad: 200 }
    })
    expect(res.status()).toBe(201)
    const list = await (await request.get(`${API}?month=${MONTH}`)).json()
    const row  = list.data.find(r => r.recipient === 'Sibling')
    expect(row.amount_inr).toBeNull()
    expect(row.notes).toBeNull()
  })

  test('returns 400 when required fields missing', async ({ request }) => {
    const res = await request.post(API, { data: { date: DATE, recipient: 'No amount' } })
    expect(res.status()).toBe(400)
  })

  test('returns 400 when amount_cad is not a positive number', async ({ request }) => {
    const res = await request.post(API, { data: { date: DATE, recipient: 'Test', amount_cad: -100 } })
    expect(res.status()).toBe(400)
  })
})

test.describe('DELETE /api/home-expenses', () => {
  test.beforeAll(() => resetTestDb())

  test('deletes a recent record', async ({ request }) => {
    const post = await request.post(API, {
      data: { date: DATE, recipient: 'Delete me', amount_cad: 100 }
    })
    const { data: { id } } = await post.json()

    const del = await request.delete(`${API}/${id}`)
    expect(del.status()).toBe(200)

    const list = await (await request.get(`${API}?month=${MONTH}`)).json()
    expect(list.data.some(r => r.id === id)).toBe(false)
  })

  test('returns 403 for record older than 3 months', async ({ request }) => {
    const post = await request.post(API, {
      data: { date: OLD_DATE, recipient: 'Old', amount_cad: 300 }
    })
    const { data: { id } } = await post.json()

    const del = await request.delete(`${API}/${id}`)
    expect(del.status()).toBe(403)
    expect((await del.json()).error).toContain(OLD_MONTH)
  })

  test('returns 404 for non-existent id', async ({ request }) => {
    expect((await request.delete(`${API}/999999`)).status()).toBe(404)
  })
})
