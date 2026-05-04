'use strict'
/**
 * Seed helpers for UI tests that need pre-existing data.
 * Use the HTTP API (request fixture) so data goes through the real routes.
 */

const API = 'http://localhost:3099'

function monthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Seed a handful of expenses for the current month via the API.
 * Returns the created expense objects with ids.
 */
async function seedExpenses(request, month = monthKey()) {
  const rows = [
    { description: 'Costco run',   category: 'Hypermarket',  amount: 134.50 },
    { description: 'Tim Hortons',  category: 'Restaurants',  amount: 8.75  },
    { description: 'Shell gas',    category: 'Fuel',         amount: 62.00 },
  ]
  const [y, m] = month.split('-')
  const date = `${y}-${m}-15`

  const ids = []
  for (const row of rows) {
    const res  = await request.post(`${API}/api/expenses`, { data: { date, ...row } })
    const body = await res.json()
    ids.push(body.data.id)
  }
  return ids
}

/**
 * Seed a credit card purchase for the current month.
 */
async function seedCCPurchase(request, month = monthKey()) {
  const [y, m] = month.split('-')
  const res = await request.post(`${API}/api/credit-card/purchases`, {
    data: {
      date: `${y}-${m}-10`,
      description: 'Amazon order',
      category: 'Purchases',
      amount: 49.99,
      my_share: 49.99,
    }
  })
  const body = await res.json()
  return body.data.id
}

module.exports = { seedExpenses, seedCCPurchase, monthKey }
