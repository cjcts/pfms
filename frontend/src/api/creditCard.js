import { fetchJson } from './fetchJson'

export async function getCreditCard(month) {
  return fetchJson(`/api/credit-card?month=${month}`)
}

export async function createPurchase(payload) {
  return fetchJson('/api/credit-card/purchases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updatePurchase(id, payload) {
  return fetchJson(`/api/credit-card/purchases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deletePurchase(id) {
  return fetchJson(`/api/credit-card/purchases/${id}`, { method: 'DELETE' })
}

export async function createPayment(payload) {
  return fetchJson('/api/credit-card/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updatePayment(id, payload) {
  return fetchJson(`/api/credit-card/payments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deletePayment(id) {
  return fetchJson(`/api/credit-card/payments/${id}`, { method: 'DELETE' })
}
