import { fetchJson } from './fetchJson'

export async function getExpenses(month) {
  return fetchJson(`/api/expenses?month=${month}`)
}

export async function createExpense(payload) {
  return fetchJson('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateExpense(id, payload) {
  return fetchJson(`/api/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteExpense(id) {
  return fetchJson(`/api/expenses/${id}`, { method: 'DELETE' })
}
