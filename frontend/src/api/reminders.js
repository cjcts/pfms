import { fetchJson } from './fetchJson'

export async function getReminders() {
  return fetchJson('/api/reminders')
}

export async function createReminder(payload) {
  return fetchJson('/api/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateReminder(id, payload) {
  return fetchJson(`/api/reminders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteReminder(id) {
  return fetchJson(`/api/reminders/${id}`, { method: 'DELETE' })
}
