export async function getSummary(month) {
  const res = await fetch(`/api/summary?month=${month}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data
}

export async function getSummaryHistory(months = 12) {
  const res = await fetch(`/api/summary/history?months=${months}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error)
  return json.data
}
