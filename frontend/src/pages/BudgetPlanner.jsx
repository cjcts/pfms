import { useState, useEffect, useCallback, useRef } from 'react'
import { BarChart2, TrendingUp, TrendingDown, AlertCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { getBudget, upsertBudget } from '../api/budget'
import { formatCAD, formatMonthLabel, currentMonthKey } from '../utils/formatters'

// ── helpers ────────────────────────────────────────────────────────────────

function progressBarColor(actual, target) {
  if (!target || target <= 0) return actual > 0 ? 'bg-red-500' : 'bg-gray-200'
  const ratio = actual / target
  if (ratio >= 1)    return 'bg-red-500'
  if (ratio >= 0.8)  return 'bg-amber-500'
  return 'bg-green-500'
}

function progressWidth(actual, target) {
  if (!target || target <= 0) return actual > 0 ? 100 : 0
  return Math.min((actual / target) * 100, 100)
}

// ── EditableTarget ───────────────────────────────────────────────────────────

function EditableTarget({ row, selectedMonth, onSaved, focusRef }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const [err, setErr]         = useState('')
  const [saving, setSaving]   = useState(false)
  const inputRef              = useRef(null)

  // Allow parent to programmatically open the edit input
  useEffect(() => {
    if (focusRef) {
      focusRef.current = () => {
        setVal(row.target > 0 ? String(row.target) : '')
        setErr('')
        setEditing(true)
      }
    }
  }, [focusRef, row.target])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function startEdit() {
    setVal(row.target > 0 ? String(row.target) : '')
    setErr('')
    setEditing(true)
  }

  async function commit() {
    const trimmed = val.trim()
    const numeric = trimmed === '' ? 0 : parseFloat(trimmed)

    if (trimmed !== '' && !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      setErr('Enter a valid amount e.g. 250.00')
      return
    }

    setSaving(true)
    try {
      await upsertBudget({ month_key: selectedMonth, category: row.category, target: numeric })
      onSaved(row.category, numeric)
      setEditing(false)
    } catch {
      setErr('Save failed')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter')  { e.preventDefault(); commit() }
    if (e.key === 'Escape') { setEditing(false); setErr('') }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1 items-end">
        <input
          ref={inputRef}
          type="text"
          value={val}
          onChange={e => { setVal(e.target.value); setErr('') }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          disabled={saving}
          placeholder="0.00"
          className={`w-28 border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500
            ${err ? 'border-red-400 bg-red-50' : 'border-teal-400'}`}
        />
        {err && <p className="text-xs text-red-500 mt-0.5">{err}</p>}
      </div>
    )
  }

  return (
    <button
      onClick={startEdit}
      title="Click to edit budget target"
      className="text-sm text-gray-700 hover:text-teal-600 hover:underline underline-offset-2 text-right transition-colors tabular-nums"
    >
      {formatCAD(row.target)}
    </button>
  )
}

// ── BudgetPlanner ────────────────────────────────────────────────────────────

export default function BudgetPlanner() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey())
  const [rows, setRows]                   = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [untrackedOpen, setUntrackedOpen]           = useState(false)
  const [untrackedEditCategory, setUntrackedEditCategory] = useState(null)

  // Map of category → focusRef so untracked pills can trigger edit on active rows
  const focusRefs = useRef({})

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getBudget(selectedMonth)
      .then(setRows)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedMonth])

  useEffect(() => { load() }, [load])

  // Optimistic local update when a target is saved; refresh after to sync sort
  function handleSaved(category, newTarget) {
    setRows(prev => prev.map(r => r.category === category ? { ...r, target: newTarget } : r))
    // Re-fetch to get proper sort order from server
    getBudget(selectedMonth).then(setRows).catch(() => {})
  }

  // Derived
  const activeRows    = rows.filter(r => r.target > 0 || r.actual > 0)
  const untrackedRows = rows.filter(r => r.target === 0 && r.actual === 0)

  const totalBudgeted = rows.reduce((s, r) => s + r.target, 0)
  const totalSpent    = rows.reduce((s, r) => s + r.actual, 0)
  const variance      = totalBudgeted - totalSpent

  // ── loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Budget Planner</h1>
            <p className="text-sm text-gray-500 mt-0.5">Monthly spending targets</p>
          </div>
        </div>
        <div className="text-center py-16 text-sm text-gray-400">Loading…</div>
      </div>
    )
  }

  // ── error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Budget Planner</h1>
            <p className="text-sm text-gray-500 mt-0.5">Monthly spending targets</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
          <AlertCircle size={15} />
          {error}
        </div>
      </div>
    )
  }

  // ── main render ────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Budget Planner</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monthly spending targets</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Total Budgeted */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex items-start gap-4">
          <div className="p-2 rounded-lg bg-gray-50 text-teal-600 shrink-0">
            <BarChart2 size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-1">Total Budgeted</p>
            <p className="text-xl font-semibold text-gray-900 tabular-nums">{formatCAD(totalBudgeted)}</p>
          </div>
        </div>

        {/* Total Spent */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex items-start gap-4">
          <div className="p-2 rounded-lg bg-gray-50 text-gray-400 shrink-0">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-1">Total Spent</p>
            <p className="text-xl font-semibold text-gray-900 tabular-nums">{formatCAD(totalSpent)}</p>
          </div>
        </div>

        {/* Variance */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex items-start gap-4">
          <div className={`p-2 rounded-lg bg-gray-50 shrink-0 ${variance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {variance >= 0 ? <TrendingDown size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-1">Variance</p>
            <p className={`text-xl font-semibold tabular-nums ${variance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatCAD(variance)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {variance >= 0 ? 'under budget' : 'over budget'}
            </p>
          </div>
        </div>
      </div>

      {/* Active categories table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-700">Active Categories</h2>
          <p className="text-xs text-gray-400 mt-0.5">Click any budget target to edit. Progress bar turns amber at 80%, red at 100%.</p>
        </div>

        {activeRows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            No categories with budgets or spending yet for {formatMonthLabel(selectedMonth)}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 font-medium">Category</th>
                  <th className="text-right px-4 py-2.5 font-medium">Budget</th>
                  <th className="text-right px-4 py-2.5 font-medium">Spent</th>
                  <th className="px-4 py-2.5 font-medium w-40">Progress</th>
                  <th className="text-center px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeRows.map(row => {
                  const fillPct   = progressWidth(row.actual, row.target)
                  const barClass  = progressBarColor(row.actual, row.target)
                  const isOver    = row.target > 0 && row.actual > row.target
                  const spentClass = isOver ? 'text-red-500 font-medium' : 'text-gray-700'

                  // Status badge
                  let badge
                  if (row.target <= 0) {
                    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">—</span>
                  } else if (isOver) {
                    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Over</span>
                  } else {
                    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Under</span>
                  }

                  // Register a focusRef for this category
                  if (!focusRefs.current[row.category]) {
                    focusRefs.current[row.category] = { current: null }
                  }

                  return (
                    <tr key={row.category} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-900 font-medium whitespace-nowrap">
                        {row.category}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <EditableTarget
                          row={row}
                          selectedMonth={selectedMonth}
                          onSaved={handleSaved}
                          focusRef={focusRefs.current[row.category]}
                        />
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${spentClass}`}>
                        {formatCAD(row.actual)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${barClass}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {badge}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Untracked categories — collapsed by default */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setUntrackedOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
        >
          <div>
            <span className="text-sm font-medium text-gray-700">Untracked Categories</span>
            <span className="ml-2 text-xs text-gray-400">({untrackedRows.length} with no budget or spending)</span>
          </div>
          {untrackedOpen
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />
          }
        </button>

        {untrackedOpen && (
          <div className="px-5 pb-5 border-t border-gray-100">
            {untrackedRows.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">All categories are active.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-4">
                {untrackedRows.map(row => {
                  // Register a focusRef for this category so the "+" button can open it
                  if (!focusRefs.current[row.category]) {
                    focusRefs.current[row.category] = { current: null }
                  }

                  const handleAddClick = () => {
                    // If the category is already in the active table (race condition), use its focusRef
                    if (focusRefs.current[row.category]?.current) {
                      focusRefs.current[row.category].current()
                    } else {
                      // Category not yet in active table — show inline editor below the grid
                      setUntrackedEditCategory(row.category)
                    }
                  }

                  return (
                    <button
                      key={row.category}
                      onClick={handleAddClick}
                      title={`Set budget for ${row.category}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 hover:bg-teal-50 hover:border-teal-200 transition-colors text-left group"
                    >
                      <span className="text-xs text-gray-600 group-hover:text-teal-700 truncate">{row.category}</span>
                      <Plus size={13} className="text-gray-300 group-hover:text-teal-500 shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}

            {/* Inline editor for categories not yet in the active table */}
            {untrackedEditCategory && (
              <UntrackedInlineEditor
                category={untrackedEditCategory}
                selectedMonth={selectedMonth}
                onSaved={(cat, tgt) => {
                  setUntrackedEditCategory(null)
                  handleSaved(cat, tgt)
                }}
                onCancel={() => setUntrackedEditCategory(null)}
              />
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// ── UntrackedInlineEditor ─────────────────────────────────────────────────────
// Shown when the user clicks "+" on a category that has no active table row yet.

function UntrackedInlineEditor({ category, selectedMonth, onSaved, onCancel }) {
  const [val, setVal]       = useState('')
  const [err, setErr]       = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef            = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function commit() {
    const trimmed = val.trim()
    if (trimmed === '') { onCancel(); return }
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) { setErr('Enter a valid amount e.g. 250.00'); return }
    const numeric = parseFloat(trimmed)
    setSaving(true)
    try {
      await upsertBudget({ month_key: selectedMonth, category, target: numeric })
      onSaved(category, numeric)
    } catch {
      setErr('Save failed')
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter')  { e.preventDefault(); commit() }
    if (e.key === 'Escape') { onCancel() }
  }

  return (
    <div className="mt-4 flex flex-col gap-1 max-w-xs">
      <p className="text-xs text-gray-500 font-medium">Set budget for <span className="text-gray-700">{category}</span></p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={val}
          onChange={e => { setVal(e.target.value); setErr('') }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          disabled={saving}
          placeholder="0.00"
          className={`w-32 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
            ${err ? 'border-red-400 bg-red-50' : 'border-teal-400'}`}
        />
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
    </div>
  )
}
