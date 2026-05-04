'use strict'
const { test, expect } = require('@playwright/test')
const { resetTestDb, insertRow } = require('../fixtures/db-reset')

const API = 'http://localhost:3099/api/owed-owing'

test.describe('GET /api/owed-owing', () => {
  test.beforeAll(() => resetTestDb())

  test('returns empty list when no records exist', async ({ request }) => {
    const res  = await request.get(`${API}?settled=false`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  test('separates unsettled and settled records', async ({ request }) => {
    // Create two records
    const r1 = await (await request.post(API, {
      data: { direction: 'to_give', person: 'Alice', amount: 100 }
    })).json()
    const r2 = await (await request.post(API, {
      data: { direction: 'to_get', person: 'Bob', amount: 50 }
    })).json()

    // Settle r1
    await request.put(`${API}/${r1.data.id}/settle`)

    const unsettled = await (await request.get(`${API}?settled=false`)).json()
    const settled   = await (await request.get(`${API}?settled=true`)).json()

    expect(unsettled.data.some(r => r.id === r1.data.id)).toBe(false)
    expect(unsettled.data.some(r => r.id === r2.data.id)).toBe(true)
    expect(settled.data.some(r => r.id === r1.data.id)).toBe(true)
  })
})

test.describe('POST /api/owed-owing', () => {
  test.beforeAll(() => resetTestDb())

  test('creates a to_give record', async ({ request }) => {
    const res  = await request.post(API, {
      data: { direction: 'to_give', person: 'Carol', amount: 200, reason: 'Dinner split', notes: 'will pay by May' }
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.id).toBeGreaterThan(0)
  })

  test('creates a to_get record', async ({ request }) => {
    const res = await request.post(API, {
      data: { direction: 'to_get', person: 'Dave', amount: 75 }
    })
    expect(res.status()).toBe(201)
  })

  test('returns 400 for invalid direction', async ({ request }) => {
    const res = await request.post(API, {
      data: { direction: 'invalid', person: 'X', amount: 10 }
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toMatch(/direction/)
  })

  test('returns 400 when person is missing', async ({ request }) => {
    const res = await request.post(API, { data: { direction: 'to_give', amount: 10 } })
    expect(res.status()).toBe(400)
  })

  test('returns 400 for non-positive amount', async ({ request }) => {
    const res = await request.post(API, { data: { direction: 'to_give', person: 'Eve', amount: 0 } })
    expect(res.status()).toBe(400)
  })
})

test.describe('PUT /api/owed-owing/:id/settle', () => {
  test.beforeAll(() => resetTestDb())

  test('marks a record as settled', async ({ request }) => {
    const post = await (await request.post(API, {
      data: { direction: 'to_give', person: 'Frank', amount: 30 }
    })).json()
    const id = post.data.id

    const settle = await request.put(`${API}/${id}/settle`)
    expect(settle.status()).toBe(200)

    const settled = (await (await request.get(`${API}?settled=true`)).json()).data
    const row     = settled.find(r => r.id === id)
    expect(row.is_settled).toBe(1)
    expect(row.settled_date).toBeTruthy()
  })

  test('returns 404 for non-existent id', async ({ request }) => {
    expect((await request.put(`${API}/999999/settle`)).status()).toBe(404)
  })
})

test.describe('DELETE /api/owed-owing', () => {
  test.beforeAll(() => resetTestDb())

  test('deletes a recent record', async ({ request }) => {
    const post = await (await request.post(API, {
      data: { direction: 'to_get', person: 'Grace', amount: 15 }
    })).json()
    const id = post.data.id

    expect((await request.delete(`${API}/${id}`)).status()).toBe(200)
    const list = (await (await request.get(`${API}?settled=false`)).json()).data
    expect(list.some(r => r.id === id)).toBe(false)
  })

  test('returns 403 for record with old date_added', async ({ request }) => {
    // Insert directly with old date_added (API always uses today)
    const id = insertRow('owed_owing', {
      direction: 'to_give',
      person: 'OldPerson',
      amount: 50,
      is_settled: 0,
      date_added: '2024-01-15',
    })

    const del = await request.delete(`${API}/${id}`)
    expect(del.status()).toBe(403)
  })

  test('returns 404 for non-existent id', async ({ request }) => {
    expect((await request.delete(`${API}/999999`)).status()).toBe(404)
  })
})
