import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Trash2, PlusCircle, Copy, AlertCircle, Pencil, ChevronDown, Search } from 'lucide-react'
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../api/expenses'
import { getSettings } from '../api/admin'
import { EXPENSE_CATEGORIES } from '../utils/categories'
import { formatCAD, formatDate, formatMonthLabel, parseDay } from '../utils/formatters'
import { useSelectedMonth } from '../utils/useSelectedMonth'
import ConfirmModal from '../components/ConfirmModal'

// ── helpers ────────────────────────────────────────────────────────────────

function todayDay() {
  return String(new Date().getDate())
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function validateForm(form, monthKey) {
  const errs = {}

  const day = form.date.trim()
  if (!day) {
    errs.date = 'Day is required'
  } else {
    const iso = parseDay(day, monthKey)
    if (!iso) {
      errs.date = `Enter a valid day (1–31) for ${monthKey}`
    } else if (iso > todayISO()) {
      errs.date = 'Cannot enter future dates'
    }
  }

  if (!form.description.trim()) errs.description = 'Description is required'
  if (!form.category) errs.category = 'Select a category'

  const amt = form.amount.trim()
  if (!amt) {
    errs.amount = 'Amount is required'
  } else if (!/^\d+(\.\d{1,2})?$/.test(amt)) {
    errs.amount = 'Enter a valid amount (e.g. 45.00)'
  } else if (parseFloat(amt) <= 0) {
    errs.amount = 'Amount must be greater than 0'
  }

  return errs
}

function emptyForm() {
  return { date: todayDay(), description: '', category: '', amount: '', notes: '', member: '' }
}

function deletableCutoff() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)
}

// ── Member tag badge ───────────────────────────────────────────────────────

function MemberTag({ name }) {
  if (!name) return null
  return (
    <span className="inline-block bg-blue-50 text-blue-700 text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0">
      {name}
    </span>
  )
}

// ── component ──────────────────────────────────────────────────────────────

export default function ExpenseEntry() {
  const [selectedMonth, setSelectedMonth] = useSelectedMonth()
  const [expenses, setExpenses]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [form, setForm]                   = useState(emptyForm)
  const [errors, setErrors]               = useState({})
  const [submitting, setSubmitting]       = useState(false)
  const [successMsg, setSuccessMsg]       = useState('')

  // categories from API with EXPENSE_CATEGORIES fallback
  const [categories, setCategories] = useState([])

  // household members
  const [members, setMembers] = useState([])

  // edit-in-place state
  const [editingId, setEditingId] = useState(null)

  // confirm delete state
  const [confirmDelete, setConfirmDelete] = useState(null)

  // copy from previous month state
  const [prevMonthExpenses, setPrevMonthExpenses] = useState([])
  const [prevMonthLoading, setPrevMonthLoading]   = useState(false)
  const [showPrevMonth, setShowPrevMonth]         = useState(false)
  const [prevSearch, setPrevSearch]               = useState('')
  const [prevPage, setPrevPage]                   = useState(0)
  const [pageSize, setPageSize]                   = useState(3)

  // monthly table search
  const [tableSearch, setTableSearch] = useState('')

  // autocomplete state
  const [allDescriptions, setAllDescriptions] = useState([])
  const [descSuggestions, setDescSuggestions] = useState([])
  const [descOpen, setDescOpen]               = useState(false)
  const [descActiveIdx, setDescActiveIdx]     = useState(-1)

  const formRef    = useRef(null)
  const descBoxRef = useRef(null)
  const cutoff     = deletableCutoff()

  // previous month key
  const prevMonthKey = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [selectedMonth])

  // effective categories: API list or fallback
  const effectiveCategories = categories.length > 0 ? categories : EXPENSE_CATEGORIES

  // filtered + paged prev-month list
  const filteredPrev = useMemo(() => {
    if (!prevSearch.trim()) return prevMonthExpenses
    const q = prevSearch.toLowerCase()
    return prevMonthExpenses.filter(e =>
      e.description.toLowerCase().includes(q) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q))
    )
  }, [prevMonthExpenses, prevSearch])

  const totalPrevPages = Math.max(1, Math.ceil(filteredPrev.length / pageSize))
  const pagedPrev = filteredPrev.slice(prevPage * pageSize, (prevPage + 1) * pageSize)

  // filtered monthly table
  const filteredExpenses = useMemo(() => {
    if (!tableSearch.trim()) return expenses
    const q = tableSearch.toLowerCase()
    return expenses.filter(e =>
      e.description.toLowerCase().includes(q) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.member && e.member.toLowerCase().includes(q))
    )
  }, [expenses, tableSearch])

  const monthTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)

  // ── data loading ──────────────────────────────────────────────────────────

  const load = useCallback(() => {
    setLoading(true)
    getExpenses(selectedMonth)
      .then(setExpenses)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedMonth])

  useEffect(() => { load() }, [load])

  // load categories, members, settings
  useEffect(() => {
    fetch('/api/admin/categories/expense')
      .then(r => r.json())
      .then(j => { if (j.success) setCategories(j.data.map(c => c.name)) })
      .catch(() => {})

    fetch('/api/admin/categories/member')
      .then(r => r.json())
      .then(j => { if (j.success) setMembers(j.data.filter(m => m.is_active).map(m => m.name)) })
      .catch(() => {})

    getSettings()
      .then(s => { if (s.records_per_page) setPageSize(parseInt(s.records_per_page, 10) || 3) })
      .catch(() => {})
  }, [])

  // reset prev-month panel when selectedMonth changes
  useEffect(() => {
    setShowPrevMonth(false)
    setPrevMonthExpenses([])
    setPrevSearch('')
    setPrevPage(0)
  }, [selectedMonth])

  // load prev-month expenses when panel is opened
  useEffect(() => {
    if (!showPrevMonth) return
    setPrevMonthLoading(true)
    getExpenses(prevMonthKey)
      .then(setPrevMonthExpenses)
      .catch(() => setPrevMonthExpenses([]))
      .finally(() => setPrevMonthLoading(false))
  }, [showPrevMonth, prevMonthKey])

  // reset page when search changes
  useEffect(() => { setPrevPage(0) }, [prevSearch])

  const loadDescriptions = useCallback(() => {
    fetch('/api/expenses/descriptions')
      .then(r => r.json())
      .then(j => j.success && setAllDescriptions(j.data))
      .catch(() => {})
  }, [])

  useEffect(() => { loadDescriptions() }, [loadDescriptions])

  // close autocomplete on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (descBoxRef.current && !descBoxRef.current.contains(e.target)) setDescOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── form handlers ─────────────────────────────────────────────────────────

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }))

    if (name === 'description') {
      if (value.trim()) {
        const q = value.toLowerCase()
        const matches = allDescriptions.filter(d => d.toLowerCase().includes(q)).slice(0, 8)
        setDescSuggestions(matches)
        setDescOpen(matches.length > 0)
        setDescActiveIdx(-1)
      } else {
        setDescOpen(false)
      }
    }
  }

  function selectSuggestion(desc) {
    setForm(f => ({ ...f, description: desc }))
    setErrors(prev => ({ ...prev, description: null }))
    setDescOpen(false)
  }

  function handleDescKeyDown(e) {
    if (!descOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDescActiveIdx(i => Math.min(i + 1, descSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDescActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && descActiveIdx >= 0) {
      e.preventDefault()
      selectSuggestion(descSuggestions[descActiveIdx])
    } else if (e.key === 'Escape') {
      setDescOpen(false)
    }
  }

  function handleEdit(expense) {
    setEditingId(expense.id)
    setForm({
      date:         String(new Date(expense.date + 'T00:00:00').getDate()),
      description:  expense.description,
      category:     expense.category,
      amount:       String(expense.amount),
      notes:        expense.notes || '',
      member:       expense.member || '',
    })
    setErrors({})
    setDescOpen(false)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setForm(emptyForm())
    setErrors({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validateForm(form, selectedMonth)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const isoDate     = parseDay(form.date, selectedMonth)
    const description = form.description.trim()
    const { category, amount, notes, member } = form

    setSubmitting(true)
    try {
      if (editingId !== null) {
        await updateExpense(editingId, {
          date:        isoDate,
          description,
          category,
          amount:      parseFloat(amount),
          notes:       notes.trim() || null,
          member:      member || null,
        })
        setEditingId(null)
        setForm(emptyForm())
        setErrors({})
        setSuccessMsg('Saved')
        setTimeout(() => setSuccessMsg(''), 2500)
        load()
      } else {
        await createExpense({
          date:        isoDate,
          description,
          category,
          amount:      parseFloat(amount),
          notes:       notes.trim() || null,
          member:      member || null,
        })
        setForm(emptyForm())
        setErrors({})
        setSuccessMsg('Expense added')
        setTimeout(() => setSuccessMsg(''), 2500)
        load()
        loadDescriptions()
      }
    } catch (err) {
      setErrors({ _form: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopy(expense) {
    setEditingId(null)
    setForm({
      date:        String(new Date(expense.date + 'T00:00:00').getDate()),
      description: expense.description,
      category:    expense.category,
      amount:      String(expense.amount),
      notes:       expense.notes || '',
      member:      expense.member || '',
    })
    setErrors({})
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleDelete(id) {
    try {
      await deleteExpense(id)
      setExpenses(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      setErrors(prev => ({ ...prev, _delete: err.message }))
      setTimeout(() => setErrors(prev => ({ ...prev, _delete: null })), 4000)
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Confirm delete modal */}
      <ConfirmModal
        isOpen={confirmDelete !== null}
        title="Delete expense?"
        message="This cannot be undone."
        onConfirm={() => { handleDelete(confirmDelete); setConfirmDelete(null) }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Add Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatMonthLabel(selectedMonth)}</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => {
            setSelectedMonth(e.target.value)
            setErrors(prev => ({ ...prev, date: null }))
          }}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Pull from previous month */}
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
                {formatMonthLabel(prevMonthKey)} — click Use to populate the form
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
                {prevSearch ? 'No results match your search.' : `No expenses in ${formatMonthLabel(prevMonthKey)}`}
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {pagedPrev.map(expense => (
                    <div key={expense.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
                      <span className="text-xs text-gray-400 w-20 shrink-0">{formatDate(expense.date)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{expense.description}</p>
                        {expense.member && <MemberTag name={expense.member} />}
                      </div>
                      <span className="text-xs text-gray-500 hidden sm:block w-28 shrink-0 truncate">{expense.category}</span>
                      <span className="text-sm text-gray-700 w-20 text-right shrink-0">{formatCAD(expense.amount)}</span>
                      <button
                        onClick={() => { handleCopy(expense); setShowPrevMonth(false) }}
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

      {/* Entry form */}
      <div ref={formRef} className={`bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-6${editingId !== null ? ' border-l-4 border-l-amber-400' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-700">
            {editingId !== null ? (
              <>
                Edit Entry
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-normal">Editing</span>
              </>
            ) : 'New Entry'}
          </h2>
          {successMsg && <span className="text-xs font-medium text-green-600">{successMsg}</span>}
        </div>

        {errors._form && (
          <div className="flex items-center gap-1.5 text-xs text-red-500 mb-3">
            <AlertCircle size={13} />{errors._form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-4">

          {/* Day input */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Day</label>
            <input
              type="number"
              name="date"
              min="1"
              max="31"
              value={form.date}
              onChange={handleChange}
              placeholder="Day"
              className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
                ${errors.date ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            />
            {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
          </div>

          {/* Description + autocomplete */}
          <div className="lg:col-span-2 relative" ref={descBoxRef}>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input
              type="text"
              name="description"
              value={form.description}
              onChange={handleChange}
              onKeyDown={handleDescKeyDown}
              onFocus={() => {
                if (form.description.trim() && descSuggestions.length > 0) setDescOpen(true)
              }}
              placeholder="What was this for?"
              autoComplete="off"
              className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
                ${errors.description ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            />
            {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}

            {descOpen && (
              <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {descSuggestions.map((d, i) => (
                  <li
                    key={d}
                    onMouseDown={() => selectSuggestion(d)}
                    className={`px-3 py-2 text-sm cursor-pointer select-none
                      ${i === descActiveIdx ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className={`w-full border rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500
                ${errors.category ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            >
              <option value="">Select…</option>
              {effectiveCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount (CAD)</label>
            <input
              type="text"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              placeholder="0.00"
              inputMode="decimal"
              className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500
                ${errors.amount ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            />
            {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
          </div>

          {/* Member */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Member <span className="text-gray-400">(optional)</span>
            </label>
            <select
              name="member"
              value={form.member}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">— none —</option>
              {members.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Any context…"
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Submit */}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              <PlusCircle size={15} />
              {submitting
                ? (editingId !== null ? 'Saving…' : 'Adding…')
                : (editingId !== null ? 'Save Changes' : 'Add Expense')}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

        </form>
      </div>

      {/* Delete error */}
      {errors._delete && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-md text-sm text-red-700 bg-red-50 border border-red-100">
          <AlertCircle size={14} />{errors._delete}
        </div>
      )}

      {/* Expense list */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h2 className="text-sm font-medium text-gray-700 shrink-0">
              {formatMonthLabel(selectedMonth)} — {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}
            </h2>
            {/* Table search */}
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search entries…"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-900 shrink-0">{formatCAD(monthTotal)}</span>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            {tableSearch ? 'No results match your search.' : 'No expenses for this month yet.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredExpenses.map(expense => {
              const canDelete = expense.month_key >= cutoff
              return (
                <div key={expense.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">

                  <span className="text-xs text-gray-400 w-20 shrink-0">{formatDate(expense.date)}</span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm text-gray-900 truncate">{expense.description}</p>
                      {expense.member && <MemberTag name={expense.member} />}
                    </div>
                    {expense.notes && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{expense.notes}</p>
                    )}
                  </div>

                  <span className="text-xs text-gray-500 hidden sm:block w-32 shrink-0 truncate">
                    {expense.category}
                  </span>

                  <span className="text-sm font-medium text-gray-900 w-24 text-right shrink-0">
                    {formatCAD(expense.amount)}
                  </span>

                  {/* Copy to form */}
                  <button
                    onClick={() => handleCopy(expense)}
                    title="Copy to form"
                    className="text-gray-300 hover:text-teal-500 transition-colors shrink-0"
                  >
                    <Copy size={14} />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleEdit(expense)}
                    title="Edit"
                    className="text-gray-300 hover:text-amber-500 transition-colors shrink-0"
                  >
                    <Pencil size={14} />
                  </button>

                  {/* Delete */}
                  {canDelete ? (
                    <button
                      onClick={() => setConfirmDelete(expense.id)}
                      title="Delete"
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span
                      title="Cannot delete records older than 3 months"
                      className="text-gray-200 cursor-not-allowed shrink-0"
                    >
                      <Trash2 size={14} />
                    </span>
                  )}

                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
