/**
 * Wrapper around fetch that:
 * 1. Always returns parsed JSON.
 * 2. Throws a readable Error when the server returns non-JSON (e.g. HTML 502/503)
 *    instead of the cryptic "Unexpected token '<'" message.
 * 3. Throws on success:false envelopes.
 */
export async function fetchJson(url, options) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    // Server returned non-JSON — backend may be down or restarting
    throw new Error(
      res.status === 0 || !res.status
        ? 'Cannot reach the backend server. Is it running?'
        : `Server returned ${res.status} (non-JSON). Backend may be down or restarting.`
    )
  }
  if (!json.success) throw new Error(json.error || 'Unknown server error')
  return json.data
}
