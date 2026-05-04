import { fetchJson } from './fetchJson'

export async function getIncome(month) {
  return fetchJson(`/api/income?month=${month}`)
}

export async function updateIncome(id, payload) {
  return fetchJson(`/api/income/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function createIncome(payload) {
  return fetchJson('/api/income', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteIncome(id) {
  return fetchJson(`/api/income/${id}`, { method: 'DELETE' })
}

export async function copyFromPrev(month, ids) {
  return fetchJson('/api/income/copy-from-prev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, ...(ids !== undefined ? { ids } : {}) }),
  })
}
