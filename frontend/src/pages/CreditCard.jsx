import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Trash2, Pencil, CreditCard as CreditCardIcon, ShoppingBag, Wallet, ChevronDown, Search, Copy } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ConfirmModal from '../components/ConfirmModal'
import { getCreditCard, createPurchase, updatePurchase, deletePurchase, createPayment, updatePayment, deletePayment, getDescriptions } from '../api/creditCard'
import { getSettings } from '../api/admin'
import { formatCAD, formatDate, formatMonthLabel, parseDay } from '../utils/formatters'
import { useSelectedMonth } from '../utils/useSelectedMonth'
import { EXPENSE_CATEGORIES } from '../utils/categories'

// ── Delete policy ─────────────────────────────────────────────────────────────

function deletableCutoff() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Amount regex ──────────────────────────────────────────────────────────────

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/

// ── Member tag ────────────────────────────────────────────────────────────────

function MemberTag({ name }) {
  if (!name) return null
  return (
    <span className="inline-block bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
      {name}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, colorClass = 'text-gray-900', bgClass = '' }) {
  return (
    <div className={`bg-white shadow-sm border border-gray-100 rounded-lg p-4 flex flex-col gap-1 ${bgClass}`}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-2xl font-semibold ${colorClass}`}>{value}</span>
    </div>
  )
}

// ── Purchase Form ─────────────────────────────────────────────────────────────

function PurchaseForm({ monthKey, onDone, formRef, editingPurchase, onCancelEdit, members }) {
  function makeEmpty() {
    return { day: String(new Date().getDate()), description: '', category: EXPENSE_CATEGORIES[0], amount: '', notes: '', member: '' }
  }

  const [fields, setFields] = useState(makeEmpty())
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState('')

  // Description autocomplete state
  const [allDescs, setAllDescs] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [descOpen, setDescOpen] = useState(false)
  const [descIdx, setDescIdx] = useState(-1)
  const descBoxRef = useRef(null)
  const descInputRef = useRef(null)

  // Fetch descriptions once on mount
  useEffect(() => {
    getDescriptions().then(setAllDescs).catch(() => {})
  }, [])

  // Filter suggestions whenever description field changes
  useEffect(() => {
    const q = fields.description.trim().toLowerCase()
    if (!q) { setSuggestions([]); setDescOpen(false); return }
    const filtered = allDescs.filter(d => d.toLowerCase().includes(q)).slice(0, 8)
    setSuggestions(filtered)
    setDescOpen(filtered.length > 0)
    setDescIdx(-1)
  }, [fields.description, allDescs])

  // Close autocomplete on outside click
  useEffect(() => {
    function handleMouseDown(e) {
      if (descBoxRef.current && !descBoxRef.current.contains(e.target)) setDescOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Populate form when editing or copying from prev month
  useEffect(() => {
    if (editingPurchase) {
      setFields({
        day: String(new Date(editingPurchase.date + 'T00:00:00').getDate()),
        description: editingPurchase.description,
        category: editingPurchase.category,
        amount: String(editingPurchase.amount),
        notes: editingPurchase.notes ?? '',
        member: editingPurchase.member ?? '',
      })
      setErrors({})
      setDescOpen(false)
      // Focus description when copying from previous month
      if (editingPurchase._copyMode) {
        setTimeout(() => descInputRef.current?.focus(), 50)
      }
    } else {
      setFields(makeEmpty())
      setErrors({})
    }
  }, [editingPurchase])

  // If _copyMode, treat as a new entry (not an edit)
  const isEditMode = editingPurchase && !editingPurchase._copyMode

  function set(key, val) {
    setFields(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}

    const isoDate = parseDay(fields.day, monthKey)
    if (!isoDate) errs.day = `Enter a valid day (1–31) for ${formatMonthLabel(monthKey)}`
    else if (isoDate > todayISO()) errs.day = 'Cannot enter future dates'

    if (!fields.description.trim()) errs.description = 'Description is required'
    if (!fields.category) errs.category = 'Category is required'
    if (!AMOUNT_RE.test(fields.amount.trim())) errs.amount = 'Enter a valid amount (e.g. 12.50)'

    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    try {
      const payload = {
        date: isoDate,
        description: fields.description.trim(),
        category: fields.category,
        amount: parseFloat(fields.amount),
        notes: fields.notes.trim() || undefined,
        member: fields.member || undefined,
      }
      if (isEditMode) {
        await updatePurchase(editingPurchase.id, payload)
        setFlash('Updated')
        onCancelEdit()
      } else {
        await createPurchase(payload)
        setFields(makeEmpty())
        setFlash('Added')
        setTimeout(() => setFlash(''), 2500)
      }
      onDone()
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const inputBase = 'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
  const inputOk = 'border-gray-300 bg-white'
  const inputErr = 'border-red-400 bg-red-50'

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {/* Day */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Day</label>
        <input
          type="number" min="1" max="31"
          placeholder="Day"
          value={fields.day}
          onChange={e => set('day', e.target.value)}
          className={`${inputBase} ${errors.day ? inputErr : inputOk}`}
        />
        {errors.day && <p className="mt-1 text-xs text-red-600">{errors.day}</p>}
      </div>

      {/* Description with autocomplete */}
      <div className="sm:col-span-2 lg:col-span-1 relative" ref={descBoxRef}>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <input
          ref={descInputRef}
          type="text"
          placeholder="e.g. Amazon order"
          value={fields.description}
          onChange={e => set('description', e.target.value)}
          onKeyDown={e => {
            if (!descOpen) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setDescIdx(i => Math.min(i + 1, suggestions.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setDescIdx(i => Math.max(i - 1, -1)) }
            else if (e.key === 'Enter' && descIdx >= 0) { e.preventDefault(); set('description', suggestions[descIdx]); setDescOpen(false); setDescIdx(-1) }
            else if (e.key === 'Escape') setDescOpen(false)
          }}
          autoComplete="off"
          className={`${inputBase} ${errors.description ? inputErr : inputOk}`}
        />
        {descOpen && suggestions.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li
                key={s}
                className={`px-3 py-2 text-sm cursor-pointer ${i === descIdx ? 'bg-teal-50 text-teal-700' : 'text-gray-800 hover:bg-gray-50'}`}
                onMouseDown={() => { set('description', s); setDescOpen(false) }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
        {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
        <select
          value={fields.category}
          onChange={e => set('category', e.target.value)}
          className={`${inputBase} ${errors.category ? inputErr : inputOk}`}
        >
          {EXPENSE_CATEGORIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Amount (CAD)</label>
        <input
          type="text"
          placeholder="0.00"
          value={fields.amount}
          onChange={e => set('amount', e.target.value)}
          className={`${inputBase} ${errors.amount ? inputErr : inputOk}`}
        />
        {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
      </div>

      {/* Member */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Member (optional)</label>
        <select
          value={fields.member}
          onChange={e => set('member', e.target.value)}
          className={`${inputBase} ${inputOk}`}
        >
          <option value="">— none —</option>
          {members.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Notes */}
      <div className="sm:col-span-2 lg:col-span-1">
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
        <input
          type="text"
          placeholder="Any context…"
          value={fields.notes}
          onChange={e => set('notes', e.target.value)}
          className={`${inputBase} ${inputOk}`}
        />
      </div>

      {/* Submit row */}
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {submitting ? (isEditMode ? 'Updating…' : 'Adding…') : (isEditMode ? 'Update Purchase' : 'Add Purchase')}
        </button>
        {editingPurchase && (
          <button type="button" onClick={onCancelEdit} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        )}
        {flash && <span className="text-sm text-green-600 font-medium">{flash}</span>}
        {errors.submit && <span className="text-sm text-red-600">{errors.submit}</span>}
      </div>
    </form>
  )
}

// ── Payment Form ──────────────────────────────────────────────────────────────

function PaymentForm({ monthKey, onDone, editingPayment, onCancelEdit }) {
  function makeEmpty() { return { day: String(new Date().getDate()), amount: '', notes: '' } }
  const [fields, setFields] = useState(makeEmpty())
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState('')

  useEffect(() => {
    if (editingPayment) {
      setFields({
        day: String(new Date(editingPayment.date + 'T00:00:00').getDate()),
        amount: String(editingPayment.amount),
        notes: editingPayment.notes ?? '',
      })
      setErrors({})
    } else {
      setFields(makeEmpty())
      setErrors({})
    }
  }, [editingPayment])

  function set(key, val) {
    setFields(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}

    const isoDate = parseDay(fields.day, monthKey)
    if (!isoDate) errs.day = `Enter a valid day (1–31) for ${formatMonthLabel(monthKey)}`
    if (!AMOUNT_RE.test(fields.amount.trim())) errs.amount = 'Enter a valid amount (e.g. 150.00)'

    if (Object.keys(errs).length) { setErrors(errs); return }

    setSubmitting(true)
    try {
      const payload = { date: isoDate, amount: parseFloat(fields.amount), notes: fields.notes.trim() || undefined }
      if (editingPayment) {
        await updatePayment(editingPayment.id, payload)
        setFlash('Updated')
        onCancelEdit()
      } else {
        await createPayment(payload)
        setFields(makeEmpty())
        setFlash('Added')
        setTimeout(() => setFlash(''), 2500)
      }
      onDone()
    } catch (err) {
      setErrors({ submit: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const inputBase = 'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
  const inputOk = 'border-gray-300 bg-white'
  const inputErr = 'border-red-400 bg-red-50'

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Day</label>
        <input
          type="number" min="1" max="31"
          placeholder="Day"
          value={fields.day}
          onChange={e => set('day', e.target.value)}
          className={`${inputBase} ${errors.day ? inputErr : inputOk}`}
        />
        {errors.day && <p className="mt-1 text-xs text-red-600">{errors.day}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Amount (CAD)</label>
        <input
          type="text"
          placeholder="0.00"
          value={fields.amount}
          onChange={e => set('amount', e.target.value)}
          className={`${inputBase} ${errors.amount ? inputErr : inputOk}`}
        />
        {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
        <input
          type="text"
          placeholder="e.g. CIBC Visa payment"
          value={fields.notes}
          onChange={e => set('notes', e.target.value)}
          className={`${inputBase} ${inputOk}`}
        />
      </div>
      <div className="sm:col-span-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {submitting ? (editingPayment ? 'Updating…' : 'Recording…') : (editingPayment ? 'Update Payment' : 'Record Payment')}
        </button>
        {editingPayment && (
          <button type="button" onClick={onCancelEdit} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        )}
        {flash && <span className="text-sm text-green-600 font-medium">{flash}</span>}
        {errors.submit && <span className="text-sm text-red-600">{errors.submit}</span>}
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CreditCard() {
  const [selectedMonth, setSelectedMonth] = useSelectedMonth()
  const [purchases, setPurchases] = useState([])
  const [payments, setPayments] = useState([])
  const [priorOutstanding, setPriorOutstanding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [members, setMembers] = useState([])

  const [editingPurchase, setEditingPurchase] = useState(null)
  const [editingPayment, setEditingPayment] = useState(null)
  const [confirmDeletePurchase, setConfirmDeletePurchase] = useState(null)
  const [confirmDeletePayment, setConfirmDeletePayment] = useState(null)

  // pull from previous month
  const [showPrevMonth, setShowPrevMonth] = useState(false)
  const [prevMonthPurchases, setPrevMonthPurchases] = useState([])
  const [prevMonthLoading, setPrevMonthLoading] = useState(false)
  const [prevSearch, setPrevSearch] = useState('')
  const [prevPage, setPrevPage] = useState(0)
  const [pageSize, setPageSize] = useState(3)

  // purchases table search
  const [tableSearch, setTableSearch] = useState('')

  const formRef = useRef(null)
  const cutoff = deletableCutoff()

  const prevMonthKey = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [selectedMonth])

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    getCreditCard(selectedMonth)
      .then(data => {
        setPurchases(data.purchases ?? [])
        setPayments(data.payments ?? [])
        setPriorOutstanding(data.priorOutstanding ?? 0)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedMonth])

  useEffect(() => { loadData() }, [loadData])

  // load members + settings once
  useEffect(() => {
    fetch('/api/admin/categories/member')
      .then(r => r.json())
      .then(j => { if (j.success) setMembers(j.data.filter(m => m.is_active).map(m => m.name)) })
      .catch(() => {})

    getSettings()
      .then(s => { if (s.records_per_page) setPageSize(parseInt(s.records_per_page, 10) || 3) })
      .catch(() => {})
  }, [])

  // reset prev-month panel on month change
  useEffect(() => {
    setShowPrevMonth(false)
    setPrevMonthPurchases([])
    setPrevSearch('')
    setPrevPage(0)
  }, [selectedMonth])

  // load prev-month purchases when panel opens
  useEffect(() => {
    if (!showPrevMonth) return
    setPrevMonthLoading(true)
    getCreditCard(prevMonthKey)
      .then(data => setPrevMonthPurchases(data.purchases ?? []))
      .catch(() => setPrevMonthPurchases([]))
      .finally(() => setPrevMonthLoading(false))
  }, [showPrevMonth, prevMonthKey])

  // reset page when search changes
  useEffect(() => { setPrevPage(0) }, [prevSearch])

  // filtered + paged prev-month list
  const filteredPrev = useMemo(() => {
    if (!prevSearch.trim()) return prevMonthPurchases
    const q = prevSearch.toLowerCase()
    return prevMonthPurchases.filter(p =>
      p.description.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q))
    )
  }, [prevMonthPurchases, prevSearch])

  const totalPrevPages = Math.max(1, Math.ceil(filteredPrev.length / pageSize))
  const pagedPrev = filteredPrev.slice(prevPage * pageSize, (prevPage + 1) * pageSize)

  // filtered purchases table
  const filteredPurchases = useMemo(() => {
    if (!tableSearch.trim()) return purchases
    const q = tableSearch.toLowerCase()
    return purchases.filter(p =>
      p.description.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q)) ||
      (p.member && p.member.toLowerCase().includes(q))
    )
  }, [purchases, tableSearch])

  // ── Summary stats
  const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0)
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
  const netOwing = totalPurchases - totalPayments + priorOutstanding

  // ── Delete handlers
  async function handleDeletePurchase(id) {
    setDeleteError(null)
    try {
      await deletePurchase(id)
      loadData()
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  async function handleDeletePayment(id) {
    setDeleteError(null)
    try {
      await deletePayment(id)
      loadData()
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  function handleEditPurchase(p) {
    setEditingPurchase(p)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleCopyPurchase(p) {
    setEditingPurchase(null)
    setTimeout(() => {
      setEditingPurchase({ ...p, _copyMode: true })
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  // ── Render
  return (
    <div className="min-h-screen bg-gray-50 p-6">

      <ConfirmModal
        isOpen={confirmDeletePurchase !== null}
        title="Delete purchase?"
        message="This cannot be undone."
        onConfirm={() => { handleDeletePurchase(confirmDeletePurchase); setConfirmDeletePurchase(null) }}
        onCancel={() => setConfirmDeletePurchase(null)}
      />

      <ConfirmModal
        isOpen={confirmDeletePayment !== null}
        title="Delete payment?"
        message="This cannot be undone."
        onConfirm={() => { handleDeletePayment(confirmDeletePayment); setConfirmDeletePayment(null) }}
        onCancel={() => setConfirmDeletePayment(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="text-teal-600" size={24} />
          <h1 className="text-2xl font-bold text-gray-900">Credit Card</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Purchases" value={formatCAD(totalPurchases)} />
        <StatCard label="Total Payments" value={formatCAD(totalPayments)} colorClass="text-green-600" />
        <StatCard label="Prior Month Outstanding" value={formatCAD(priorOutstanding)} colorClass="text-amber-600" bgClass="bg-amber-50" />
        <StatCard label="Net Owing" value={formatCAD(netOwing)} colorClass={netOwing <= 0 ? 'text-green-600' : 'text-red-500'} />
      </div>

      {/* Global delete error */}
      {deleteError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {loading && <div className="text-center py-12 text-gray-500 text-sm">Loading…</div>}
      {!loading && error && <div className="text-center py-12 text-red-500 text-sm">{error}</div>}

      {!loading && !error && (
        <>
          {/* ── Pull from previous month ───────────────────────────────── */}
          <div className="mb-4">
            <button
              onClick={() => setShowPrevMonth(p => !p)}
              className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              <ChevronDown size={14} className={showPrevMonth ? 'rotate-180 transition-transform' : 'transition-transform'} />
              Pull from {formatMonthLabel(prevMonthKey)}
            </button>

            {showPrevMonth && (
              <div className="mt-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                {/* Panel header with search */}
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">
                    {formatMonthLabel(prevMonthKey)} purchases — click Use to populate the form
                  </span>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search…"
                      value={prevSearch}
                      onChange={e => setPrevSearch(e.target.value)}
                      className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-md text-sm w-44 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {prevMonthLoading ? (
                  <div className="px-5 py-6 text-sm text-gray-400 text-center">Loading…</div>
                ) : filteredPrev.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-gray-400 text-center">
                    {prevSearch ? 'No results match your search.' : `No purchases in ${formatMonthLabel(prevMonthKey)}`}
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-50">
                      {pagedPrev.map(p => (
                        <div key={p.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
                          <span className="text-xs text-gray-400 w-20 shrink-0">{formatDate(p.date)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{p.description}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-400">{p.category}</span>
                              {p.member && <MemberTag name={p.member} />}
                            </div>
                          </div>
                          <span className="text-sm text-gray-700 w-20 text-right shrink-0">{formatCAD(p.amount)}</span>
                          <button
                            onClick={() => {
                              setEditingPurchase(null)
                              setEditingPurchase({ ...p, _copyMode: true })
                              setShowPrevMonth(false)
                              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }}
                            className="text-xs px-2.5 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded font-medium shrink-0"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* Pagination */}
                    {totalPrevPages > 1 && (
                      <div className="flex items-center justify-between px-5 py-2 border-t border-gray-100 bg-gray-50">
                        <button
                          onClick={() => setPrevPage(p => Math.max(0, p - 1))}
                          disabled={prevPage === 0}
                          className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-white"
                        >
                          ← Prev
                        </button>
                        <span className="text-xs text-gray-500">
                          Page {prevPage + 1} of {totalPrevPages} ({filteredPrev.length} records)
                        </span>
                        <button
                          onClick={() => setPrevPage(p => Math.min(totalPrevPages - 1, p + 1))}
                          disabled={prevPage >= totalPrevPages - 1}
                          className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-white"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Purchases section ─────────────────────────────────────────── */}
          <div className="bg-white shadow-sm border border-gray-100 rounded-lg p-5 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingPurchase && !editingPurchase._copyMode ? 'Edit Purchase' : 'New Purchase'}
            </h2>
            <PurchaseForm
              monthKey={selectedMonth}
              onDone={loadData}
              formRef={formRef}
              editingPurchase={editingPurchase}
              onCancelEdit={() => setEditingPurchase(null)}
              members={members}
            />

            {/* Purchases table header with search */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Purchases — {formatMonthLabel(selectedMonth)}
              </h2>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search purchases…"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  className="pl-7 pr-3 py-1.5 border border-gray-200 rounded-md text-sm w-48 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {filteredPurchases.length === 0 ? (
              <EmptyState
                icon={ShoppingBag}
                title={tableSearch ? 'No results match your search.' : 'No purchases this month'}
                subtitle={tableSearch ? '' : 'Add your first credit card purchase above.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 pr-3 font-medium text-gray-600">Date</th>
                      <th className="pb-2 pr-3 font-medium text-gray-600">Description</th>
                      <th className="pb-2 pr-3 font-medium text-gray-600">Category</th>
                      <th className="pb-2 pr-3 font-medium text-gray-600 text-right">Amount</th>
                      <th className="pb-2 pr-3 font-medium text-gray-600">Notes</th>
                      <th className="pb-2 pr-3 font-medium text-gray-600">Member</th>
                      <th className="pb-2 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map(p => {
                      const canDelete = p.month_key >= cutoff
                      return (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{formatDate(p.date)}</td>
                          <td className="py-2 pr-3 text-gray-900">{p.description}</td>
                          <td className="py-2 pr-3 text-gray-600">{p.category}</td>
                          <td className="py-2 pr-3 text-gray-900 text-right whitespace-nowrap">{formatCAD(p.amount)}</td>
                          <td className="py-2 pr-3 text-gray-500 max-w-xs truncate">{p.notes ?? ''}</td>
                          <td className="py-2 pr-3">
                            <MemberTag name={p.member} />
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2 justify-end">
                              {/* Copy to form */}
                              <button
                                onClick={() => handleCopyPurchase(p)}
                                title="Copy to new purchase form"
                                className="text-gray-300 hover:text-teal-500 transition-colors"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => handleEditPurchase(p)}
                                title="Edit"
                                className="text-gray-400 hover:text-amber-500 transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              {canDelete ? (
                                <button
                                  onClick={() => setConfirmDeletePurchase(p.id)}
                                  title="Delete"
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : (
                                <span title="Cannot delete records older than 3 months" className="text-gray-200 cursor-not-allowed">
                                  <Trash2 size={14} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Payments section ──────────────────────────────────────────── */}
          <div className="bg-white shadow-sm border border-gray-100 rounded-lg p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingPayment ? 'Edit Payment' : 'Record Payment'}
            </h2>
            <PaymentForm
              monthKey={selectedMonth}
              onDone={loadData}
              editingPayment={editingPayment}
              onCancelEdit={() => setEditingPayment(null)}
            />

            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Payments — {formatMonthLabel(selectedMonth)}
            </h2>

            {payments.length === 0 ? (
              <EmptyState icon={Wallet} title="No payments recorded" subtitle="Record a payment to track your balance." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 pr-3 font-medium text-gray-600">Date</th>
                      <th className="pb-2 pr-3 font-medium text-gray-600 text-right">Amount</th>
                      <th className="pb-2 pr-3 font-medium text-gray-600">Notes</th>
                      <th className="pb-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => {
                      const canDelete = p.month_key >= cutoff
                      return (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{formatDate(p.date)}</td>
                          <td className="py-2 pr-3 text-gray-900 text-right whitespace-nowrap">{formatCAD(p.amount)}</td>
                          <td className="py-2 pr-3 text-gray-500">{p.notes ?? ''}</td>
                          <td className="py-2 text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => setEditingPayment(p)}
                                title="Edit"
                                className="text-gray-400 hover:text-amber-500 transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              {canDelete ? (
                                <button
                                  onClick={() => setConfirmDeletePayment(p.id)}
                                  title="Delete"
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : (
                                <span title="Cannot delete records older than 3 months" className="text-gray-200 cursor-not-allowed">
                                  <Trash2 size={14} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
