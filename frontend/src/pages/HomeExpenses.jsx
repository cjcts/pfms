import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Copy, Trash2, PlusCircle, Home, ChevronDown, ChevronUp } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ConfirmModal from '../components/ConfirmModal'
import { getHomeExpenses, createHomeExpense, updateHomeExpense, deleteHomeExpense, copyFromPrev } from '../api/homeExpenses'
import { formatCAD, formatDate, formatMonthLabel, parseDay } from '../utils/formatters'
import { useSelectedMonth } from '../utils/useSelectedMonth'

// ── Delete-policy helper ──────────────────────────────────────────────────────

function deletableCutoff() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)
}

function prevMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── Blank form state ──────────────────────────────────────────────────────────

function blankForm() {
  return { day: String(new Date().getDate()), recipient: '', amount_cad: '', notes: '' }
}

// ── Inline-editable row ───────────────────────────────────────────────────────

function HomeExpenseRow({ entry, selectedMonth, recipients, cutoff, onSaved, onDelete, onCopy }) {
  const [editing, setEditing] = useState(null) // 'day' | 'recipient' | 'amount_cad' | 'notes'
  const [vals, setVals] = useState({
    day: entry.date ? String(new Date(entry.date + 'T00:00:00').getDate()) : '',
    recipient: entry.recipient,
    amount_cad: String(entry.amount_cad),
    notes: entry.notes ?? '',
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setVals({
      day: entry.date ? String(new Date(entry.date + 'T00:00:00').getDate()) : '',
      recipient: entry.recipient,
      amount_cad: String(entry.amount_cad),
      notes: entry.notes ?? '',
    })
    setDirty(false)
    setSaveError('')
  }, [entry])

  function change(field, value) {
    setVals(v => ({ ...v, [field]: value }))
    setDirty(true)
  }

  async function handleSave() {
    const dateIso = vals.day ? parseDay(vals.day, selectedMonth) : null
    const amountNum = parseFloat(vals.amount_cad)
    if (!vals.recipient || isNaN(amountNum) || amountNum <= 0) { setSaveError('Invalid fields'); return }

    setSaving(true)
    setSaveError('')
    try {
      await updateHomeExpense(entry.id, {
        date: dateIso || entry.date,
        recipient: vals.recipient,
        amount_cad: amountNum,
        notes: vals.notes.trim() || null,
      })
      setSaved(true)
      setDirty(false)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { setEditing(null); handleSave() }
    if (e.key === 'Escape') setEditing(null)
  }

  const canDelete = entry.month_key >= cutoff
  const inp = 'border border-teal-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300'
  const display = 'cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5 inline-block'

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-50">
      {/* Date */}
      <td className="px-6 py-3 text-gray-700 whitespace-nowrap">
        {editing === 'day'
          ? <input type="number" min="1" max="31" autoFocus className={`${inp} w-16`}
              value={vals.day} onChange={e => change('day', e.target.value)}
              onBlur={() => setEditing(null)} onKeyDown={handleKeyDown} />
          : <span className={display} onClick={() => setEditing('day')} title="Click to edit">
              {vals.day
                ? (() => { const iso = parseDay(vals.day, selectedMonth); return iso ? formatDate(iso) : formatDate(entry.date) })()
                : '—'}
            </span>
        }
      </td>
      {/* Category */}
      <td className="px-6 py-3 font-medium text-gray-900">
        {editing === 'recipient'
          ? recipients.length > 0
            ? <select autoFocus className={inp} value={vals.recipient}
                onChange={e => change('recipient', e.target.value)}
                onBlur={() => setEditing(null)} onKeyDown={handleKeyDown}>
                {recipients.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            : <input type="text" autoFocus className={`${inp} w-32`} value={vals.recipient}
                onChange={e => change('recipient', e.target.value)}
                onBlur={() => setEditing(null)} onKeyDown={handleKeyDown} />
          : <span className={display} onClick={() => setEditing('recipient')} title="Click to edit">
              {vals.recipient}
            </span>
        }
      </td>
      {/* Amount CAD */}
      <td className="px-6 py-3 text-right">
        {editing === 'amount_cad'
          ? <input type="text" autoFocus className={`${inp} w-24 text-right`} value={vals.amount_cad}
              onChange={e => change('amount_cad', e.target.value)}
              onBlur={() => setEditing(null)} onKeyDown={handleKeyDown} />
          : <span className={`${display} font-semibold text-teal-700`} onClick={() => setEditing('amount_cad')} title="Click to edit">
              {formatCAD(parseFloat(vals.amount_cad) || 0)}
            </span>
        }
      </td>
      {/* Amount INR — read-only historical */}
      <td className="whitespace-nowrap px-6 py-3 text-right text-gray-600">
        {entry.amount_inr != null
          ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(entry.amount_inr)
          : '—'}
      </td>
      {/* Notes */}
      <td className="px-6 py-3 max-w-xs">
        {editing === 'notes'
          ? <input type="text" autoFocus className={`${inp} w-full`} value={vals.notes}
              onChange={e => change('notes', e.target.value)}
              onBlur={() => setEditing(null)} onKeyDown={handleKeyDown} />
          : <span className={`${display} text-gray-500 min-w-[60px]`} onClick={() => setEditing('notes')} title="Click to edit">
              {vals.notes || <span className="italic text-gray-300">Add note…</span>}
            </span>
        }
      </td>
      {/* Actions */}
      <td className="px-6 py-3 text-center whitespace-nowrap">
        {saveError && <span className="text-xs text-red-500 mr-1">{saveError}</span>}
        {!saveError && saved && !dirty && (
          <span className="text-xs text-green-600 font-medium mr-2">Saved</span>
        )}
        {dirty && (
          <button onClick={handleSave} disabled={saving}
            className="text-xs px-2 py-1 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 mr-2 transition-colors">
            {saving ? '…' : 'Save'}
          </button>
        )}
        <button type="button" title="Copy to form" onClick={() => onCopy(entry)}
          className="inline-flex items-center justify-center rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-teal-600">
          <Copy size={14} />
        </button>
        {canDelete
          ? <button type="button" title="Delete" onClick={() => onDelete(entry.id)}
              className="inline-flex items-center justify-center rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          : <button type="button" title="Cannot delete records older than 3 months" disabled
              className="inline-flex cursor-not-allowed items-center justify-center rounded p-1 text-gray-200">
              <Trash2 size={14} />
            </button>
        }
      </td>
    </tr>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeExpenses() {
  const [selectedMonth, setSelectedMonth] = useSelectedMonth()
  const [entries, setEntries] = useState([])
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState(blankForm())
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [addedFlash, setAddedFlash] = useState(false)

  const [deleteError, setDeleteError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [copySuccess, setCopySuccess] = useState(false)

  // Import panel state
  const [showImport, setShowImport] = useState(false)
  const [prevEntries, setPrevEntries] = useState([])
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importSearch, setImportSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [importing, setImporting] = useState(false)

  const formRef = useRef(null)
  const prevKey = prevMonthKey(selectedMonth)

  // ── Load entries ────────────────────────────────────────────────────────────

  const loadEntries = useCallback(() => {
    setLoading(true)
    setError(null)
    getHomeExpenses(selectedMonth)
      .then(({ rows, recipients: recs }) => {
        setEntries(rows)
        setRecipients(recs)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedMonth])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // ── Form helpers ────────────────────────────────────────────────────────────

  function handleFormChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setFieldErrors(prev => ({ ...prev, [field]: undefined }))
    if (deleteError) setDeleteError(null)
  }

  function validateForm() {
    const errors = {}
    const amountCadRegex = /^\d+(\.\d{1,2})?$/

    const isoDate = parseDay(form.day, selectedMonth)
    if (!isoDate) {
      errors.day = `Enter a valid day (1–31) for ${formatMonthLabel(selectedMonth)}`
    }

    if (!form.recipient.trim()) {
      errors.recipient = 'Category is required'
    }

    if (!form.amount_cad.trim()) {
      errors.amount_cad = 'Amount (CAD) is required'
    } else if (!amountCadRegex.test(form.amount_cad.trim())) {
      errors.amount_cad = 'Enter a valid amount (e.g. 1200 or 1200.50)'
    }

    return errors
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const isoDate = parseDay(form.day, selectedMonth)
    const payload = {
      date: isoDate,
      recipient: form.recipient.trim(),
      amount_cad: parseFloat(form.amount_cad.trim()),
      notes: form.notes.trim() || null,
    }

    setSubmitting(true)
    try {
      await createHomeExpense(payload)
      setForm(blankForm())
      setFieldErrors({})
      setAddedFlash(true)
      setTimeout(() => setAddedFlash(false), 2500)
      loadEntries()
    } catch (err) {
      setFieldErrors({ _form: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Copy-to-form ────────────────────────────────────────────────────────────

  function handleCopy(entry) {
    setForm({
      day: String(new Date(entry.date + 'T00:00:00').getDate()),
      recipient: entry.recipient,
      amount_cad: String(entry.amount_cad),
      notes: entry.notes ?? '',
    })
    setFieldErrors({})
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(id) {
    setDeleteError(null)
    try {
      await deleteHomeExpense(id)
      loadEntries()
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  // ── Import panel ────────────────────────────────────────────────────────────

  async function handleToggleImport() {
    const next = !showImport
    setShowImport(next)
    if (next && prevEntries.length === 0) {
      setImportLoading(true)
      setImportError(null)
      try {
        const { rows } = await getHomeExpenses(prevKey)
        setPrevEntries(rows)
        setSelectedIds(new Set(rows.map(r => r.id)))
      } catch (err) {
        setImportError(err.message)
      } finally {
        setImportLoading(false)
      }
    }
  }

  // Reload prev entries when prevKey changes (month picker changed)
  useEffect(() => {
    if (showImport) {
      setPrevEntries([])
      setSelectedIds(new Set())
      setImportError(null)
      setImportLoading(true)
      getHomeExpenses(prevKey)
        .then(({ rows }) => {
          setPrevEntries(rows)
          setSelectedIds(new Set(rows.map(r => r.id)))
        })
        .catch(err => setImportError(err.message))
        .finally(() => setImportLoading(false))
    }
  }, [prevKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPrevEntries = useMemo(() => {
    if (!importSearch.trim()) return prevEntries
    const q = importSearch.toLowerCase()
    return prevEntries.filter(r =>
      r.recipient.toLowerCase().includes(q) ||
      (r.notes ?? '').toLowerCase().includes(q)
    )
  }, [prevEntries, importSearch])

  function toggleSelectAll() {
    if (filteredPrevEntries.every(r => selectedIds.has(r.id))) {
      // deselect all visible
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredPrevEntries.forEach(r => next.delete(r.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredPrevEntries.forEach(r => next.add(r.id))
        return next
      })
    }
  }

  function toggleRow(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleImport() {
    if (selectedIds.size === 0) return
    setImporting(true)
    setImportError(null)
    try {
      await copyFromPrev(selectedMonth, Array.from(selectedIds))
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 3000)
      setShowImport(false)
      setPrevEntries([])
      setSelectedIds(new Set())
      loadEntries()
    } catch (err) {
      setImportError(err.message)
    } finally {
      setImporting(false)
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const cutoff = deletableCutoff()
  const totalCAD = entries.reduce((sum, e) => sum + e.amount_cad, 0)

  // ── Field class helpers ─────────────────────────────────────────────────────

  function inputClass(field) {
    const base =
      'w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500'
    return fieldErrors[field]
      ? `${base} border-red-400 bg-red-50`
      : `${base} border-gray-300 bg-white`
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      <ConfirmModal
        isOpen={confirmDelete !== null}
        title="Delete home expense?"
        message="This cannot be undone."
        onConfirm={() => { handleDelete(confirmDelete); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Home className="text-teal-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Home Expenses</h1>
          </div>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        />
      </div>

      {copySuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Successfully imported from {formatMonthLabel(prevKey)}.
        </div>
      )}

      {/* Summary stat card */}
      <div className="mb-6">
        <div className="inline-block rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Total CAD — {formatMonthLabel(selectedMonth)}
          </p>
          <p className="mt-1 text-3xl font-bold text-teal-700">{formatCAD(totalCAD)}</p>
          <p className="mt-0.5 text-sm text-gray-400">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
        </div>
      </div>

      {/* Import from previous month panel */}
      <div className="mb-4 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={handleToggleImport}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-teal-700 hover:bg-teal-50 transition-colors"
        >
          <span>← Import from {formatMonthLabel(prevKey)}</span>
          {showImport ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showImport && (
          <div className="border-t border-gray-100 px-5 py-4">
            {importLoading && (
              <p className="text-sm text-gray-400 py-2">Loading {formatMonthLabel(prevKey)} entries…</p>
            )}
            {importError && (
              <p className="text-sm text-red-500 py-2">{importError}</p>
            )}
            {!importLoading && !importError && prevEntries.length === 0 && (
              <p className="text-sm text-gray-400 py-2">No entries found in {formatMonthLabel(prevKey)}.</p>
            )}
            {!importLoading && prevEntries.length > 0 && (
              <>
                <input
                  type="text"
                  placeholder="Search category or notes…"
                  value={importSearch}
                  onChange={e => setImportSearch(e.target.value)}
                  className="w-full mb-3 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="he-select-all"
                    checked={filteredPrevEntries.length > 0 && filteredPrevEntries.every(r => selectedIds.has(r.id))}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-teal-600"
                  />
                  <label htmlFor="he-select-all" className="text-xs text-gray-500 select-none cursor-pointer">
                    Select all ({filteredPrevEntries.length})
                  </label>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-lg mb-3">
                  {filteredPrevEntries.map(r => (
                    <label key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleRow(r.id)}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900">{r.recipient}</span>
                        <span className="ml-2 text-sm text-teal-700">{formatCAD(r.amount_cad)}</span>
                        {r.notes && <span className="ml-2 text-xs text-gray-400 truncate">{r.notes}</span>}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={selectedIds.size === 0 || importing}
                  onClick={handleImport}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  {importing ? 'Importing…' : `Import (${selectedIds.size})`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* New Entry form */}
      <div ref={formRef} className="mb-8 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">New Entry</h2>
          {addedFlash && (
            <span className="rounded-md bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
              Added
            </span>
          )}
        </div>

        {fieldErrors._form && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{fieldErrors._form}</p>
        )}

        <form noValidate onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Day */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Day</label>
              <input
                type="number"
                min="1"
                max="31"
                className={inputClass('day')}
                placeholder="Day"
                value={form.day}
                onChange={e => handleFormChange('day', e.target.value)}
              />
              {fieldErrors.day && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.day}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Category</label>
              {recipients.length > 0 ? (
                <select
                  className={inputClass('recipient')}
                  value={form.recipient}
                  onChange={e => handleFormChange('recipient', e.target.value)}
                >
                  <option value="">Select category</option>
                  {recipients.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  className={inputClass('recipient')}
                  placeholder="e.g. Parents"
                  value={form.recipient}
                  onChange={e => handleFormChange('recipient', e.target.value)}
                />
              )}
              {fieldErrors.recipient && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.recipient}</p>
              )}
            </div>

            {/* Amount CAD */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Amount (CAD)</label>
              <input
                type="text"
                className={inputClass('amount_cad')}
                placeholder="0.00"
                value={form.amount_cad}
                onChange={e => handleFormChange('amount_cad', e.target.value)}
              />
              {fieldErrors.amount_cad && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.amount_cad}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Notes <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                className={inputClass('notes')}
                placeholder="Any context…"
                value={form.notes}
                onChange={e => handleFormChange('notes', e.target.value)}
              />
            </div>

            {/* Submit */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                <PlusCircle size={16} />
                {submitting ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* Entries table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            Entries — {formatMonthLabel(selectedMonth)}
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm text-red-500">{error}</div>
        ) : entries.length === 0 ? (
          <EmptyState icon={Home} title="No home expenses" subtitle="India remittances and large transfers will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3 text-right">Amount (CAD)</th>
                  <th className="px-6 py-3 text-right">Amount (INR)</th>
                  <th className="px-6 py-3">Notes</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map(entry => (
                  <HomeExpenseRow
                    key={entry.id}
                    entry={entry}
                    selectedMonth={selectedMonth}
                    recipients={recipients}
                    cutoff={cutoff}
                    onSaved={loadEntries}
                    onDelete={id => setConfirmDelete(id)}
                    onCopy={handleCopy}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={2} className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Total
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-teal-700">
                    {formatCAD(totalCAD)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
