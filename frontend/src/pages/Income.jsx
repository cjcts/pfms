import { useState, useEffect, useCallback, useMemo } from 'react'
import { Trash2, PlusCircle, DollarSign, TrendingUp, ChevronDown, Search } from 'lucide-react'
import { getIncome, updateIncome, createIncome, deleteIncome, copyFromPrev } from '../api/income'
import { formatCAD, formatDate, formatMonthLabel, parseDay } from '../utils/formatters'
import { useSelectedMonth } from '../utils/useSelectedMonth'
import ConfirmModal from '../components/ConfirmModal'

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/

function prevMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Income() {
  const [selectedMonth, setSelectedMonth] = useSelectedMonth()
  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editCell, setEditCell] = useState(null) // { id, field }
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Import panel state
  const [showImport, setShowImport] = useState(false)
  const [prevRows, setPrevRows] = useState([])
  const [prevLoading, setPrevLoading] = useState(false)
  const [importSearch, setImportSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)

  // inline add form
  const [addForm, setAddForm] = useState({ day: '', source: '', actual: '', notes: '' })
  const [addError, setAddError] = useState({})
  const [adding, setAdding] = useState(false)

  const prevKey = prevMonthKey(selectedMonth)

  const fetchData = useCallback(() => {
    setLoading(true)
    setError(null)
    getIncome(selectedMonth)
      .then(data => {
        if (Array.isArray(data)) { setRows(data); setCategories([]) }
        else { setRows(data.rows ?? []); setCategories(data.categories ?? []) }
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [selectedMonth])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset import panel on month change
  useEffect(() => {
    setShowImport(false)
    setPrevRows([])
    setSelectedIds(new Set())
    setImportSearch('')
  }, [selectedMonth])

  // Fetch prev month rows when import panel opens
  useEffect(() => {
    if (!showImport) return
    setPrevLoading(true)
    getIncome(prevKey)
      .then(data => {
        const allRows = Array.isArray(data) ? data : (data.rows ?? [])
        const nonOB = allRows.filter(r => r.source !== 'Opening Balance')
        setPrevRows(nonOB)
        setSelectedIds(new Set(nonOB.map(r => r.id))) // select all by default
        setPrevLoading(false)
      })
      .catch(() => { setPrevRows([]); setPrevLoading(false) })
  }, [showImport, prevKey])

  // Derived totals
  const totalActual = rows.reduce((sum, r) => sum + (r.actual ?? 0), 0)

  // Filtered prev rows for import
  const filteredPrev = useMemo(() => {
    if (!importSearch.trim()) return prevRows
    const q = importSearch.toLowerCase()
    return prevRows.filter(r => r.source.toLowerCase().includes(q) || (r.notes && r.notes.toLowerCase().includes(q)))
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

  // ── Inline cell edit ────────────────────────────────────────────────────────
  function startEdit(row, field) {
    setEditCell({ id: row.id, field })
    if (field === 'actual') {
      setEditValue(String(row.actual ?? 0))
    } else if (field === 'day') {
      setEditValue(row.date ? String(new Date(row.date + 'T00:00:00').getDate()) : '')
    } else {
      setEditValue(row[field] ?? '')
    }
  }

  async function commitEdit() {
    if (!editCell) return
    const { id, field } = editCell
    const row = rows.find(r => r.id === id)
    if (!row) { setEditCell(null); return }

    let payload = {}
    if (field === 'actual') {
      if (!AMOUNT_RE.test(editValue) && editValue !== '') { setEditCell(null); return }
      payload = { actual: parseFloat(editValue) || 0 }
    } else if (field === 'notes') {
      payload = { notes: editValue }
    } else if (field === 'source') {
      payload = { source: editValue }
    } else if (field === 'day') {
      const iso = parseDay(editValue, selectedMonth)
      if (!iso) { setEditCell(null); return }
      payload = { date: iso }
    }

    try {
      await updateIncome(id, payload)
      fetchData()
    } catch (_) {}
    setEditCell(null)
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditCell(null)
  }

  // ── Add row ─────────────────────────────────────────────────────────────────
  async function handleAdd() {
    const errs = {}
    const isoDate = parseDay(addForm.day, selectedMonth)
    if (!isoDate) errs.day = 'Enter a valid day (1–31)'
    if (!addForm.source) errs.source = 'Select a source'
    const actualVal = addForm.actual.trim()
    if (!actualVal || !AMOUNT_RE.test(actualVal)) errs.actual = 'Enter a valid amount'

    if (Object.keys(errs).length > 0) { setAddError(errs); return }

    setAdding(true)
    try {
      await createIncome({ date: isoDate, source: addForm.source, actual: parseFloat(actualVal), notes: addForm.notes.trim() || null, month_key: selectedMonth })
      setAddForm({ day: '', source: '', actual: '', notes: '' })
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
      await deleteIncome(id)
      fetchData()
    } catch (err) {
      setError(err.message)
    }
  }

  const inputBase = 'border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-full'

  return (
    <div className="p-6 max-w-5xl mx-auto">

      <ConfirmModal
        isOpen={confirmDelete !== null}
        title="Delete income entry?"
        message="This cannot be undone."
        onConfirm={() => { handleDelete(confirmDelete); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Income</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatMonthLabel(selectedMonth)}</p>
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

      {/* Summary card */}
      <div className="mb-6">
        <div className="inline-flex bg-white border border-gray-100 shadow-sm rounded-lg p-5 items-center gap-4">
          <div className="p-3 rounded-full bg-teal-100">
            <TrendingUp className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Income</p>
            <p className="text-xl font-semibold text-teal-700">{formatCAD(totalActual)}</p>
          </div>
        </div>
      </div>

      {/* ── Import from previous month (collapsible panel) ──────────────── */}
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
                {importSearch ? 'No results match your search.' : `No income entries in ${formatMonthLabel(prevKey)}`}
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
                      <span className="flex-1 text-sm text-gray-800 font-medium">{row.source}</span>
                      {row.date && <span className="text-xs text-gray-400">{formatDate(row.date)}</span>}
                      <span className="text-sm text-gray-700 w-20 text-right">{formatCAD(row.actual ?? 0)}</span>
                      {row.notes && <span className="text-xs text-gray-400 max-w-[120px] truncate">{row.notes}</span>}
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

      {/* Table */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <DollarSign className="w-5 h-5 mr-2 animate-pulse" />
            Loading…
          </div>
        ) : error ? (
          <div className="px-4 py-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Amount (CAD)</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isOB = row.source === 'Opening Balance'
                  const rowBg = isOB ? 'bg-teal-50' : 'bg-white hover:bg-gray-50'
                  const isEditingDay    = editCell?.id === row.id && editCell?.field === 'day'
                  const isEditingSource = editCell?.id === row.id && editCell?.field === 'source'
                  const isEditingActual = editCell?.id === row.id && editCell?.field === 'actual'
                  const isEditingNotes  = editCell?.id === row.id && editCell?.field === 'notes'

                  return (
                    <tr key={row.id} className={`border-b border-gray-100 transition-colors ${rowBg}`}>
                      {/* Date */}
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {isEditingDay ? (
                          <input
                            type="number" min="1" max="31"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            autoFocus
                            className={inputBase + ' w-16'}
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5"
                            onClick={() => !isOB && startEdit(row, 'day')}
                            title={isOB ? undefined : 'Click to edit'}
                          >
                            {row.date ? formatDate(row.date) : '—'}
                          </span>
                        )}
                      </td>
                      {/* Source */}
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
                        {isEditingSource ? (
                          <select
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            autoFocus
                            className={inputBase}
                          >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <span
                            className={isOB ? '' : 'cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5'}
                            onClick={() => !isOB && categories.length > 0 && startEdit(row, 'source')}
                            title={!isOB && categories.length > 0 ? 'Click to edit' : undefined}
                          >
                            {row.source}
                            {isOB && <span className="ml-2 text-xs text-teal-600 font-normal">(carry-forward)</span>}
                          </span>
                        )}
                      </td>
                      {/* Amount */}
                      <td className="px-4 py-3 text-right w-36">
                        {isEditingActual ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            autoFocus
                            className={inputBase + ' text-right'}
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:bg-gray-100 rounded px-2 py-1 text-sm text-gray-800 inline-block min-w-[80px] text-right"
                            onClick={() => startEdit(row, 'actual')}
                            title="Click to edit"
                          >
                            {formatCAD(row.actual ?? 0)}
                          </span>
                        )}
                      </td>
                      {/* Notes */}
                      <td className="px-4 py-3 w-64">
                        {isEditingNotes ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={handleEditKeyDown}
                            autoFocus
                            className={inputBase}
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:bg-gray-100 rounded px-2 py-1 text-sm text-gray-500 inline-block w-full min-h-[24px]"
                            onClick={() => startEdit(row, 'notes')}
                            title="Click to edit"
                          >
                            {row.notes || <span className="italic text-gray-300">Add note…</span>}
                          </span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap w-24">
                        {!isOB && (
                          <button
                            onClick={() => setConfirmDelete(row.id)}
                            title="Delete"
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {/* Add row */}
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="number" min="1" max="31"
                      placeholder="Day"
                      value={addForm.day}
                      onChange={e => { setAddForm(f => ({ ...f, day: e.target.value })); setAddError(er => ({ ...er, day: null })) }}
                      className={`border rounded px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-teal-500 ${addError.day ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    />
                    {addError.day && <p className="text-xs text-red-500 mt-0.5">{addError.day}</p>}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={addForm.source}
                      onChange={e => { setAddForm(f => ({ ...f, source: e.target.value })); setAddError(er => ({ ...er, source: null })) }}
                      className={`border rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500 ${addError.source ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    >
                      <option value="">Select source</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {addError.source && <p className="text-xs text-red-500 mt-0.5">{addError.source}</p>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number" step="0.01"
                      placeholder="0.00"
                      value={addForm.actual}
                      onChange={e => { setAddForm(f => ({ ...f, actual: e.target.value })); setAddError(er => ({ ...er, actual: null })) }}
                      className={`border rounded px-2 py-1 text-sm w-28 text-right focus:outline-none focus:ring-2 focus:ring-teal-500 ${addError.actual ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    />
                    {addError.actual && <p className="text-xs text-red-500 mt-0.5">{addError.actual}</p>}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Notes"
                      value={addForm.notes}
                      onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                  <td className={`px-4 py-3 text-sm font-semibold text-right ${actualColor}`}>
                    {formatCAD(totalActual)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Click any Amount or Notes cell to edit. Press Enter to save.
      </p>
    </div>
  )
}
