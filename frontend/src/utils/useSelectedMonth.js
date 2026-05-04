import { useState } from 'react'
import { currentMonthKey } from './formatters'

const LS_KEY = 'pfms_selected_month'

/**
 * Drop-in replacement for useState(currentMonthKey()).
 * Persists the selected month in localStorage so it survives page navigation.
 */
export function useSelectedMonth() {
  const [month, setMonthState] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) || currentMonthKey()
    } catch {
      return currentMonthKey()
    }
  })

  function setMonth(m) {
    setMonthState(m)
    try { localStorage.setItem(LS_KEY, m) } catch (_) {}
  }

  return [month, setMonth]
}
