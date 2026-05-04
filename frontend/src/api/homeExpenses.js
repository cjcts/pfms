import { fetchJson } from './fetchJson'

export async function getHomeExpenses(month) {
  const data = await fetchJson(`/api/home-expenses?month=${encodeURIComponent(month)}`)
  // API returns { rows, recipients }
  if (Array.isArray(data)) return { rows: data, recipients: [] }
  return { rows: data.rows ?? [], recipients: data.recipients ?? [] }
}

export async function createHomeExpense(payload) {
  return fetchJson('/api/home-expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateHomeExpense(id, payload) {
  return fetchJson(`/api/home-expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteHomeExpense(id) {
  return fetchJson(`/api/home-expenses/${id}`, { method: 'DELETE' })
}

export async function copyFromPrev(month, ids) {
  return fetchJson('/api/home-expenses/copy-from-prev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, ...(ids !== undefined ? { ids } : {}) }),
  })
}
