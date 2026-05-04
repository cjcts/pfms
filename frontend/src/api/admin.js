import { fetchJson } from './fetchJson'

const BASE = '/api/admin'

export async function getCategories(type) {
  return fetchJson(`${BASE}/categories/${type}`)
}

export async function addCategory(type, name) {
  return fetchJson(`${BASE}/categories/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export async function toggleCategory(type, id, is_active) {
  return fetchJson(`${BASE}/categories/${type}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active }),
  })
}

export async function deleteCategory(type, id) {
  return fetchJson(`${BASE}/categories/${type}/${id}`, { method: 'DELETE' })
}

export async function getCleanDataPreview(month) {
  return fetchJson(`${BASE}/clean-data?month=${encodeURIComponent(month)}`)
}

export async function cleanData(month) {
  return fetchJson(`${BASE}/clean-data?month=${encodeURIComponent(month)}`, { method: 'DELETE' })
}

export async function getSettings() {
  return fetchJson(`${BASE}/settings`)
}

export async function updateSetting(key, value) {
  return fetchJson(`${BASE}/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
}
