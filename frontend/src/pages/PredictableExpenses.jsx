import { useState, useEffect, useCallback, useMemo } from 'react'
import { CalendarDays, CheckCircle, PlusCircle, Trash2, ChevronDown, Search } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ConfirmModal from '../components/ConfirmModal'
import { getPredictable, updatePredictable, createPredictable, deletePredictable, copyFromPrev } from '../api/predictable'
import { formatCAD, formatDate, formatMonthLabel, parseDay } from '../utils/formatters'
import { useSelectedMonth } from '../utils/useSelectedMonth'

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/

function prevMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, colorClass }) {
  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-5 flex items-center gap-4">
      <div className={`p-3 rounded-full bg-opacity-10 ${colorClass.replace('text-', 'bg-').replace('-600', '-100').replace('-500', '-100')}`}>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

// ── Inline amount cell ────────────────────────────────────────────────────────
function AmountCell({ value, error, onChange, onKeyDown }) {
  const [editing, setEditing] = useState(false)

  return (
    <td className="px-4 py-3 text-right w-36">
      {editing ? (
        <div>
          <input
            type="text"
            className={`w-full text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 ${
              error ? 'border-red-400 focus:ring-red-300' : 'border-teal-400 focus:ring-teal-300'
            }`}
            value={value}
            onChange={onChange}
            onBlur={() => setEditing(false)}
            onKeyDown={onKeyDown}
            autoFocus
          />
          {error && <p className="text-xs text-red-500 mt-0.5 text-right">{error}</p>}
        </div>
      ) : (
        <span
          className="cursor-pointer hover:bg-gray-100 rounded px-2 py-1 text-sm text-gray-800 inline-block min-w-[80px] text-right"
          onClick={() => setEditing(true)}
          tabIndex={0}
          onFocus={() => setEditing(true)}
          title="Click to edit"
        >
          {formatCAD(parseFloat(value) || 0)}
        </span>
      )}
    </td>
  )
}

// ── Inline notes cell ─────────────────────────────────────────────────────────
function NotesCell({ value, onChange, onKeyDown }) {
  const [editing, setEditing] = useState(false)

  return (
    <td className="px-4 py-3 w-48">
      {editing ? (
        <input
          type="text"
          className="w-full border border-teal-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          value={value}
          onChange={onChange}
          onBlur={() => setEditing(false)}
          onKeyDown={onKeyDown}
          autoFocus
        />
      ) : (
        <span
          className="cursor-pointer hover:bg-gray-100 rounded px-2 py-1 text-sm text-gray-500 inline-block w-full min-h-[24px]"
          onClick={() => setEditing(true)}
          tabIndex={0}
          onFocus={() => setEditing(true)}
          title="Click to edit"
        >
          {value || <span className="italic text-gray-300">Add note…</span>}
        </span>
      )}
    </td>
  )
}

// ── Inline day cell ───────────────────────────────────────────────────────────
function DayCell({ value, monthKey, onChange, onKeyDown }) {
  const [editing, setEditing] = useState(false)

  return (
    <td className="px-4 py-3 text-sm text-gray-700 w-28">
      {editing ? (
        <input
          type="number" min="1" max="31"
          className="w-full border border-teal-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          value={value}
          onChange={onChange}
          onBlur={() => setEditing(false)}
          onKeyDown={onKeyDown}
          autoFocus
        />
      ) : (
        <span
          className="cursor-pointer hover:bg-gray-100 rounded px-2 py-1 text-sm text-gray-700 inline-block"
          onClick={() => setEditing(true)}
          tabIndex={0}
          onFocus={() => setEditing(true)}
          title="Click to edit"
        >
          {value
            ? (() => {
                const iso = value.includes('-') ? value : parseDay(value, monthKey)
                return iso ? formatDate(iso) : value
              })()
            : <span className="italic text-gray-300">—</span>
          }
        </span>
      )}
    </td>
  )
}

// ── Predictable expense row ───────────────────────────────────────────────────
function PredictableRow({ row, selectedMonth, onSaved, onDelete }) {
  const [state, setState] = useState({
    id: row.id, category: row.category,
    actual: String(row.actual ?? 0), notes: row.notes ?? '', date: row.date ?? '',
    dirty: false, saving: false, saved: false, actualErr: '',
  })
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    setState({
      id: row.id, category: row.category,
      actual: String(row.actual ?? 0), notes: row.notes ?? '', date: row.date ?? '',
      dirty: false, saving: false, saved: false, actualErr: '',
    })
    setSaveError('')
  }, [row])

  function validate(val) {
    if (val !== '' && !AMOUNT_RE.test(val)) return 'Enter a valid amount (e.g. 1234.56)'
    return ''
  }

  function handleActualChange(e) {
    const val = e.target.value
    setState(s => ({ ...s, actual: val, actualErr: validate(val), dirty: true, saved: false }))
  }
  function handleNotesChange(e) {
    setState(s => ({ ...s, notes: e.target.value, dirty: true, saved: false }))
  }
  function handleDayChangeWrapped(e) {
    setState(s => ({ ...s, date: e.target.value, dirty: true, saved: false }))
  }

  async function handleSave() {
    const actualErr = validate(state.actual)
    if (actualErr) { setState(s => ({ ...s, actualErr })); return }

    let dateIso = null
    if (state.date) {
      dateIso = parseDay(state.date, selectedMonth)
      if (!dateIso && state.date.includes('-')) dateIso = state.date
    }

    setState(s => ({ ...s, saving: true }))
    setSaveError('')
    try {
      await updatePredictable(state.id, { actual: parseFloat(state.actual) || 0, notes: state.notes, date: dateIso })
      setState(s => ({ ...s, saving: false, dirty: false, saved: true }))
      setTimeout(() => setState(s => ({ ...s, saved: false })), 2000)
      if (onSaved) onSaved()
    } catch (err) {
      setState(s => ({ ...s, saving: false }))
      setSaveError(err.message)
      setTimeout(() => setSaveError(''), 4000)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave() }
  }

  const dayDisplay = state.date || ''
  const rowBg = 'bg-white hover:bg-gray-50'

  return (
    <tr className={`border-b border-gray-100 transition-colors ${rowBg}`}>
      <DayCell value={dayDisplay} monthKey={selectedMonth} onChange={handleDayChangeWrapped} onKeyDown={handleKeyDown} />
      <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">{row.category}</td>
      <AmountCell value={state.actual} error={state.actualErr} onChange={handleActualChange} onKeyDown={handleKeyDown} />
      <NotesCell value={state.notes} onChange={handleNotesChange} onKeyDown={handleKeyDown} />
      <td className="px-4 py-3 text-right whitespace-nowrap w-36">
        {saveError && <span className="text-xs text-red-500">{saveError}</span>}
        {!saveError && state.saved && !state.dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        {state.dirty && (
          <button
            onClick={handleSave}
            disabled={state.saving || !!state.actualErr}
            className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mr-2"
          >
            {state.saving ? 'Saving…' : 'Save'}
          </button>
        )}
        <button onClick={() => onDelete(row.id)} title="Delete" className="text-gray-300 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// ── Main page component ───────────────────────────────────────────────────────
export default function PredictableExpenses() {
  const [selectedMonth, setSelectedMonth] = useSelectedMonth()
  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Import panel state
  const [showImport, setShowImport] = useState(false)
  const [prevRows, setPrevRows] = useState([])
  const [prevLoading, setPrevLoading] = useState(false)
  const [importSearch, setImportSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)

  // Inline add form
  const [addForm, setAddForm] = useState({ category: '', day: '', actual: '', notes: '' })
  const [addError, setAddError] = useState({})
  const [adding, setAdding] = useState(false)

  const prevKey = prevMonthKey(selectedMonth)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)
    getPredictable(selectedMonth)
      .then(data => {
        if (Array.isArray(data)) { setRows(data); setCategories([]) }
        else { setRows(data.rows ?? []); setCategories(data.categories ?? []) }
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset import panel when month changes
  useEffect(() => {
    setShowImport(false)
    setPrevRows([])
    setSelectedIds(new Set())
    setImportSearch('')
  }, [selectedMonth])

  // Fetch prev month rows when panel opens
  useEffect(() => {
    if (!showImport) return
    setPrevLoading(true)
    getPredictable(prevKey)
      .then(data => {
        const r = Array.isArray(data) ? data : (data.rows ?? [])
        setPrevRows(r)
        setSelectedIds(new Set(r.map(row => row.id))) // select all by default
        setPrevLoading(false)
      })
      .catch(() => { setPrevRows([]); setPrevLoading(false) })
  }, [showImport, prevKey])

  // Derived totals
  const totalActual = rows.reduce((sum, r) => sum + (r.actual ?? 0), 0)

  // Filtered prev rows
  const filteredPrev = useMemo(() => {
    if (!importSearch.trim()) return prevRows
    const q = importSearch.toLowerCase()
    return prevRows.filter(r => r.category.toLowerCase().includes(q) || (r.notes && r.notes.toLowerCase().includes(q)))
  }, [prevRows, importSearch])

  const allFilteredSelected = filteredPrev.length > 0 && filteredPrev.every(r => selectedIds.has(r.id))

  function toggleId(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredPrev.forEach(r => next.delete(r.id))
      } else {
        filteredPrev.forEach(r => next.add(r.id))
      }
      return next
    })
  }

  async function handleImport() {
    if (selectedIds.size === 0) return
    setImporting(true)
    try {
      await copyFromPrev(selectedMonth, Array.from(selectedIds))
      setImportSuccess(true)
      setShowImport(false)
      setTimeout(() => setImportSuccess(false), 3000)
      fetchData()
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  // ── Add row ─────────────────────────────────────────────────────────────────
  async function handleAdd() {
    const errs = {}
    if (!addForm.category) errs.category = 'Select a category'
    const actualVal = addForm.actual.trim()
    if (!actualVal || !AMOUNT_RE.test(actualVal)) errs.actual = 'Enter a valid amount'

    let dateIso = null
    if (addForm.day.trim()) {
      dateIso = parseDay(addForm.day, selectedMonth)
      if (!dateIso) errs.day = 'Enter a valid day (1–31)'
    }

    if (Object.keys(errs).length > 0) { setAddError(errs); return }

    setAdding(true)
    try {
      await createPredictable({ month_key: selectedMonth, category: addForm.category, actual: parseFloat(actualVal), notes: addForm.notes.trim() || null, date: dateIso })
      setAddForm({ category: '', day: '', actual: '', notes: '' })
      setAddError({})
      fetchData()
    } catch (err) {
      setAddError({ _form: err.message })
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id) {
    try {
      await deletePredictable(id)
      fetchData()
    } catch (err) {
      setError(err.message)
    }
  }

  const inputBase = 'border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      <ConfirmModal
        isOpen={confirmDelete !== null}
        title="Delete fixed expense?"
        message="This cannot be undone."
        onConfirm={() => { handleDelete(confirmDelete); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fixed Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Recurring monthly commitments · {formatMonthLabel(selectedMonth)}
          </p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>

      {importSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Successfully imported from {formatMonthLabel(prevKey)}.
        </div>
      )}

      {/* ── Summary cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Total Actual" value={formatCAD(totalActual)} icon={CalendarDays} colorClass="text-teal-600" />
        <StatCard label="Entries" value={rows.length} icon={CheckCircle} colorClass="text-green-600" />
      </div>

      {/* ── Import from previous month (collapsible panel) ─────────────── */}
      <div className="mb-4">
        <button
          onClick={() => setShowImport(p => !p)}
          className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium"
        >
          <ChevronDown size={14} className={showImport ? 'rotate-180 transition-transform' : 'transition-transform'} />
          Import from {formatMonthLabel(prevKey)}
        </button>

        {showImport && (
          <div className="mt-3 bg-white border border-gray-100 rounded-xl shadow-sm">
            {/* Panel header */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">
                Select entries to import from {formatMonthLabel(prevKey)}
              </span>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={importSearch}
                  onChange={e => setImportSearch(e.target.value)}
                  className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-md text-sm w-44 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {prevLoading ? (
              <div className="px-5 py-6 text-sm text-gray-400 text-center">Loading…</div>
            ) : filteredPrev.length === 0 ? (
              <div className="px-5 py-6 text-sm text-gray-400 text-center">
                {importSearch ? 'No results match your search.' : `No entries in ${formatMonthLabel(prevKey)}`}
              </div>
            ) : (
              <>
                {/* Select all row */}
                <div className="flex items-center gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAllFiltered}
                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-xs font-medium text-gray-600">
                    {allFilteredSelected ? 'Deselect all' : 'Select all'} ({filteredPrev.length})
                  </span>
                </div>

                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {filteredPrev.map(row => (
                    <label key={row.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleId(row.id)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="flex-1 text-sm text-gray-800 font-medium">{row.category}</span>
                      {row.date && <span className="text-xs text-gray-400">{formatDate(row.date)}</span>}
                      <span className="text-sm text-gray-700 w-20 text-right">{formatCAD(row.actual ?? 0)}</span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-500">{selectedIds.size} of {prevRows.length} selected</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowImport(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing || selectedIds.size === 0}
                      className="px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
                    >
                      {importing ? 'Importing…' : `Import ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <CalendarDays className="w-5 h-5 mr-2 animate-pulse" />
            Loading…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actual</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                      No fixed expenses yet. Use the form below to add one.
                    </td>
                  </tr>
                ) : (
                  rows.map(row => (
                    <PredictableRow
                      key={row.id}
                      row={row}
                      selectedMonth={selectedMonth}
                      onSaved={fetchData}
                      onDelete={id => setConfirmDelete(id)}
                    />
                  ))
                )}

                {/* Inline add row */}
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="number" min="1" max="31"
                      placeholder="Day"
                      value={addForm.day}
                      onChange={e => { setAddForm(f => ({ ...f, day: e.target.value })); setAddError(er => ({ ...er, day: null })) }}
                      className={`${inputBase} w-16 ${addError.day ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    />
                    {addError.day && <p className="text-xs text-red-500 mt-0.5">{addError.day}</p>}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={addForm.category}
                      onChange={e => { setAddForm(f => ({ ...f, category: e.target.value })); setAddError(er => ({ ...er, category: null })) }}
                      className={`${inputBase} w-full ${addError.category ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    >
                      <option value="">Select category</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {addError.category && <p className="text-xs text-red-500 mt-0.5">{addError.category}</p>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="text"
                      placeholder="0.00"
                      value={addForm.actual}
                      onChange={e => { setAddForm(f => ({ ...f, actual: e.target.value })); setAddError(er => ({ ...er, actual: null })) }}
                      className={`${inputBase} w-28 text-right ${addError.actual ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    />
                    {addError.actual && <p className="text-xs text-red-500 mt-0.5">{addError.actual}</p>}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Notes"
                      value={addForm.notes}
                      onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                      className={`${inputBase} w-full border-gray-300`}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={handleAdd}
                      disabled={adding}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-teal-600 text-white text-xs font-medium rounded hover:bg-teal-700 disabled:opacity-50 transition-colors"
                    >
                      <PlusCircle size={13} />
                      {adding ? 'Adding…' : 'Add'}
                    </button>
                    {addError._form && <p className="text-xs text-red-500 mt-0.5">{addError._form}</p>}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">{formatCAD(totalActual)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Click any Actual, Date, or Notes cell to edit. Press Enter or click Save to persist.
      </p>
    </div>
  )
}
