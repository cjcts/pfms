'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb } = require('../fixtures/db-reset')

const API   = 'http://localhost:3099/api/predictable'
const MONTH = '2025-06'

const DEFAULT_CATEGORIES = [
  'House Rental', 'Car loan / EMI', 'Insurances', 'Investments',
  'Savings', 'Home Expenses (India)', 'Mobile bill payment',
  'EB bill payment', 'Car wash & service', 'Transfers',
  'Offerings', 'Tithe', 'Miscellaneous',
]

test.describe('GET /api/predictable', () => {
  test.beforeAll(() => resetTestDb())

  test('returns 400 when month is missing', async ({ request }) => {
    const res = await request.get(API)
    expect(res.status()).toBe(400)
  })

  test('seeds 13 default categories on first access', async ({ request }) => {
    const res  = await request.get(`${API}?month=${MONTH}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(13)

    const seededCats = body.data.map(r => r.category)
    for (const cat of DEFAULT_CATEGORIES) {
      expect(seededCats).toContain(cat)
    }
  })

  test('all seeded rows have budget=0 and actual=0', async ({ request }) => {
    const body = (await (await request.get(`${API}?month=${MONTH}`)).json())
    expect(body.data.every(r => r.budget === 0 && r.actual === 0)).toBe(true)
  })

  test('returns the same 13 rows on second access (no re-seeding)', async ({ request }) => {
    const body = (await (await request.get(`${API}?month=${MONTH}`)).json())
    expect(body.data).toHaveLength(13)
  })
})

test.describe('PUT /api/predictable/:id', () => {
  test.beforeAll(() => resetTestDb())

  test('updates budget and actual', async ({ request }) => {
    const rows = (await (await request.get(`${API}?month=${MONTH}`)).json()).data
    const row  = rows.find(r => r.category === 'House Rental')

    const res = await request.put(`${API}/${row.id}`, {
      data: { budget: 1800, actual: 1800 }
    })
    expect(res.status()).toBe(200)
    expect((await res.json()).success).toBe(true)

    const updated = (await (await request.get(`${API}?month=${MONTH}`)).json()).data
    const updRow  = updated.find(r => r.id === row.id)
    expect(updRow.budget).toBe(1800)
    expect(updRow.actual).toBe(1800)
  })

  test('partial update — only budget changed, actual unchanged', async ({ request }) => {
    const rows = (await (await request.get(`${API}?month=${MONTH}`)).json()).data
    const row  = rows.find(r => r.category === 'Insurances')

    await request.put(`${API}/${row.id}`, { data: { budget: 300 } })

    const updated = (await (await request.get(`${API}?month=${MONTH}`)).json()).data
    const updRow  = updated.find(r => r.id === row.id)
    expect(updRow.budget).toBe(300)
    expect(updRow.actual).toBe(0) // unchanged
  })

  test('stores notes', async ({ request }) => {
    const rows = (await (await request.get(`${API}?month=${MONTH}`)).json()).data
    const row  = rows.find(r => r.category === 'Savings')

    await request.put(`${API}/${row.id}`, { data: { notes: 'TFSA contribution' } })

    const updated = (await (await request.get(`${API}?month=${MONTH}`)).json()).data
    expect(updated.find(r => r.id === row.id).notes).toBe('TFSA contribution')
  })

  test('returns 404 for non-existent id', async ({ request }) => {
    expect((await request.put(`${API}/999999`, { data: { budget: 100 } })).status()).toBe(404)
  })
})
