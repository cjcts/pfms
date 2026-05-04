import { fetchJson } from './fetchJson'

export async function getPredictable(month) {
  return fetchJson(`/api/predictable?month=${month}`)
}

export async function updatePredictable(id, payload) {
  return fetchJson(`/api/predictable/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function createPredictable(payload) {
  return fetchJson('/api/predictable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deletePredictable(id) {
  return fetchJson(`/api/predictable/${id}`, { method: 'DELETE' })
}

export async function copyFromPrev(month, ids) {
  return fetchJson('/api/predictable/copy-from-prev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, ...(ids !== undefined ? { ids } : {}) }),
  })
}
