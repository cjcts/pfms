export const formatCAD = (amount) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 2
  }).format(amount ?? 0)

export const formatDate = (isoString) =>
  new Date(isoString + 'T00:00:00').toLocaleDateString('en-CA', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

export const formatMonthLabel = (monthKey) => {
  const [y, m] = monthKey.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
}

export const currentMonthKey = () => new Date().toISOString().slice(0, 7)

// Converts a day number string (e.g. "14") + a month key ("2026-04") → ISO date "2026-04-14".
// Returns null if the day is out of range or produces an invalid calendar date (e.g. Apr 31).
export const parseDay = (dayStr, monthKey) => {
  const d = parseInt(dayStr, 10)
  if (isNaN(d) || d < 1 || d > 31) return null
  const iso = `${monthKey}-${String(d).padStart(2, '0')}`
  const dt = new Date(iso + 'T00:00:00')
  if (isNaN(dt.getTime()) || dt.getDate() !== d) return null
  return iso
}
