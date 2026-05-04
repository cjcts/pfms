import { fetchJson } from './fetchJson'

export async function getBudget(month) {
  return fetchJson(`/api/budget?month=${encodeURIComponent(month)}`)
}

export async function upsertBudget(payload) {
  return fetchJson('/api/budget', {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
}
