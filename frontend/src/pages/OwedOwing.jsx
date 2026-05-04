import { useState, useEffect, useCallback } from 'react'
import { PlusCircle, CheckCircle, Trash2, ChevronDown, ChevronUp, AlertCircle, ArrowUpRight, ArrowDownLeft, CheckCircle2 } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { getOwedOwing, createOwedOwing, settleOwedOwing, deleteOwedOwing } from '../api/owedOwing'
import { formatCAD, formatDate } from '../utils/formatters'

// ── Delete policy ────────────────────────────────────────────────────────────
function deletableCutoff() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)
}

function isDeletable(date_added) {
  return date_added.slice(0, 7) >= deletableCutoff()
}

function isoToDDMMYYYY(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Form initial state ────────────────────────────────────────────────────────
const EMPTY_FORM = {
  direction: 'to_give',
  person: '',
  amount: '',
  reason: '',
  date_given: '',
  notes: '',
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OwedOwing() {
  const [outstanding, setOutstanding] = useState([])
  const [settled, setSettled] = useState([])
  const [activeTab, setActiveTab] = useState('outstanding')
  const [loadingOutstanding, setLoadingOutstanding] = useState(true)
  const [loadingSettled, setLoadingSettled] = useState(false)
  const [error, setError] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [successFlash, setSuccessFlash] = useState(false)

  const [actionError, setActionError] = useState(null)

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadOutstanding = useCallback(async () => {
    setLoadingOutstanding(true)
    setError(null)
    try {
      const data = await getOwedOwing(false)
      setOutstanding(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingOutstanding(false)
    }
  }, [])

  const loadSettled = useCallback(async () => {
    setLoadingSettled(true)
    try {
      const data = await getOwedOwing(true)
      setSettled(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingSettled(false)
    }
  }, [])

  useEffect(() => {
    loadOutstanding()
  }, [loadOutstanding])

  useEffect(() => {
    if (activeTab === 'settled') {
      loadSettled()
    }
  }, [activeTab, loadSettled])

  // ── Summary totals ──────────────────────────────────────────────────────────
  const totalIOwе = outstanding
    .filter(e => e.direction === 'to_give')
    .reduce((s, e) => s + e.amount, 0)

  const totalOwedToMe = outstanding
    .filter(e => e.direction === 'to_get')
    .reduce((s, e) => s + e.amount, 0)

  // ── Form handling ────────────────────────────────────────────────────────────
  function handleFormChange(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setFieldErrors(fe => ({ ...fe, [field]: undefined }))
  }

  function validateForm() {
    const errors = {}
    if (!form.person.trim()) errors.person = 'Person name is required'
    if (!form.amount.trim()) {
      errors.amount = 'Amount is required'
    } else if (!/^\d+(\.\d{1,2})?$/.test(form.amount.trim()) || Number(form.amount) <= 0) {
      errors.amount = 'Enter a valid positive amount (e.g. 150 or 99.99)'
    }
    if (!form.date_given) {
      errors.date_given = 'Date is required'
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
    setSubmitting(true)
    setActionError(null)
    try {
      await createOwedOwing({
        direction: form.direction,
        person: form.person.trim(),
        amount: Number(form.amount),
        reason: form.reason.trim() || undefined,
        date_given: form.date_given || undefined,
        notes: form.notes.trim() || undefined,
      })
      setForm(EMPTY_FORM)
      setFieldErrors({})
      setSuccessFlash(true)
      setTimeout(() => setSuccessFlash(false), 2500)
      await loadOutstanding()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function handleSettle(id) {
    setActionError(null)
    try {
      await settleOwedOwing(id)
      await loadOutstanding()
      if (activeTab === 'settled') await loadSettled()
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleDelete(id, date_added) {
    if (!isDeletable(date_added)) return
    setActionError(null)
    try {
      await deleteOwedOwing(id)
      await loadOutstanding()
      if (activeTab === 'settled') await loadSettled()
    } catch (err) {
      setActionError(err.message)
    }
  }

  // ── Partitioned outstanding ──────────────────────────────────────────────────
  const toGive = outstanding.filter(e => e.direction === 'to_give')
  const toGet = outstanding.filter(e => e.direction === 'to_get')

  // ── Render helpers ───────────────────────────────────────────────────────────
  function DeleteButton({ id, date_added }) {
    const canDelete = isDeletable(date_added)
    return (
      <button
        onClick={() => handleDelete(id, date_added)}
        disabled={!canDelete}
        title={canDelete ? 'Delete' : 'Cannot delete records older than 3 months'}
        className={`p-1.5 rounded transition-colors ${
          canDelete
            ? 'text-red-500 hover:bg-red-50'
            : 'text-gray-300 cursor-not-allowed'
        }`}
      >
        <Trash2 size={16} />
      </button>
    )
  }

  function OutstandingRow({ entry, accentClass }) {
    return (
      <div className={`flex items-start gap-3 p-3 rounded-lg border-l-4 bg-white border border-gray-100 shadow-sm ${accentClass}`}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{entry.person}</span>
            {entry.reason && (
              <span className="text-sm text-gray-500 truncate">— {entry.reason}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="font-bold text-gray-900">{formatCAD(entry.amount)}</span>
            <span className="text-xs text-gray-500">
              Date: {formatDate(entry.date_given || entry.date_added)}
            </span>
          </div>
          {entry.notes && (
            <p className="text-xs text-gray-500 mt-1 italic">{entry.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleSettle(entry.id)}
            title="Mark as settled"
            className="p-1.5 rounded text-teal-600 hover:bg-teal-50 transition-colors"
          >
            <CheckCircle size={16} />
          </button>
          <DeleteButton id={entry.id} date_added={entry.date_added} />
        </div>
      </div>
    )
  }

  function SettledRow({ entry }) {
    const directionLabel = entry.direction === 'to_give' ? 'I Owed' : 'Owed Me'
    const directionClass = entry.direction === 'to_give'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-teal-100 text-teal-700'
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-white border border-gray-100 shadow-sm">
        <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
          <span className="font-medium text-gray-900 truncate">{entry.person}</span>
          {entry.reason && (
            <span className="text-sm text-gray-500 truncate hidden sm:block">— {entry.reason}</span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${directionClass}`}>
            {directionLabel}
          </span>
          <span className="font-semibold text-gray-800">{formatCAD(entry.amount)}</span>
          {entry.settled_date && (
            <span className="text-xs text-gray-400">Settled {isoToDDMMYYYY(entry.settled_date)}</span>
          )}
        </div>
        <DeleteButton id={entry.id} date_added={entry.date_added} />
      </div>
    )
  }

  // ── Page ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Owed &amp; Owing</h1>
          <p className="text-gray-500 text-sm mt-1">Track money you owe and money owed to you</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-500 font-medium">I Owe</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{formatCAD(totalIOwе)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {toGive.length} outstanding {toGive.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-sm text-gray-500 font-medium">Owed to Me</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">{formatCAD(totalOwedToMe)}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {toGet.length} outstanding {toGet.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>

        {/* Action error banner */}
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{actionError}</span>
            <button onClick={() => setActionError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Add entry form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <button
            onClick={() => setShowForm(f => !f)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="flex items-center gap-2 font-semibold text-gray-900">
              <PlusCircle size={18} className="text-teal-600" />
              Add Entry
            </span>
            {showForm ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {showForm && (
            <div className="border-t border-gray-100 px-5 pb-5 pt-4">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">

                {/* Direction toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleFormChange('direction', 'to_give')}
                      className={`py-2.5 px-4 rounded-lg border-2 font-medium text-sm transition-colors ${
                        form.direction === 'to_give'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 text-gray-500 hover:border-amber-200'
                      }`}
                    >
                      I Owe Someone
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormChange('direction', 'to_get')}
                      className={`py-2.5 px-4 rounded-lg border-2 font-medium text-sm transition-colors ${
                        form.direction === 'to_get'
                          ? 'border-teal-600 bg-teal-50 text-teal-700'
                          : 'border-gray-200 text-gray-500 hover:border-teal-200'
                      }`}
                    >
                      Someone Owes Me
                    </button>
                  </div>
                </div>

                {/* Person */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.person}
                    onChange={e => handleFormChange('person', e.target.value)}
                    placeholder="Name"
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                      fieldErrors.person ? 'border-red-400 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {fieldErrors.person && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.person}</p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (CAD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.amount}
                    onChange={e => handleFormChange('amount', e.target.value)}
                    placeholder="0.00"
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                      fieldErrors.amount ? 'border-red-400 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {fieldErrors.amount && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.amount}</p>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    value={form.reason}
                    onChange={e => handleFormChange('reason', e.target.value)}
                    placeholder="What is this for?"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Date Given/Received */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Given/Received <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.date_given}
                    onChange={e => handleFormChange('date_given', e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                      fieldErrors.date_given ? 'border-red-400 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {fieldErrors.date_given && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.date_given}</p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => handleFormChange('notes', e.target.value)}
                    placeholder="Any additional context"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                {/* Submit */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Adding…' : 'Add Entry'}
                  </button>
                  {successFlash && (
                    <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                      <CheckCircle size={14} /> Added
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-xl shadow-sm border border-gray-100 p-1">
          <button
            onClick={() => setActiveTab('outstanding')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'outstanding'
                ? 'bg-teal-600 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Outstanding
          </button>
          <button
            onClick={() => setActiveTab('settled')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'settled'
                ? 'bg-teal-600 text-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Settled History
          </button>
        </div>

        {/* Outstanding tab */}
        {activeTab === 'outstanding' && (
          <>
            {loadingOutstanding ? (
              <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
            ) : error ? (
              <div className="text-center py-10 text-red-500 text-sm">{error}</div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="inline-block w-1 h-4 bg-amber-500 rounded" />
                    I Owe
                  </h2>
                  {toGive.length === 0 ? (
                    <EmptyState icon={ArrowUpRight} title="Nothing owed to others" subtitle="Add an entry when you borrow money or owe someone." />
                  ) : (
                    <div className="space-y-2">
                      {toGive.map(entry => (
                        <OutstandingRow key={entry.id} entry={entry} accentClass="border-l-amber-400" />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-teal-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="inline-block w-1 h-4 bg-teal-500 rounded" />
                    Owed to Me
                  </h2>
                  {toGet.length === 0 ? (
                    <EmptyState icon={ArrowDownLeft} title="No one owes you" subtitle="Add an entry when someone owes you money." />
                  ) : (
                    <div className="space-y-2">
                      {toGet.map(entry => (
                        <OutstandingRow key={entry.id} entry={entry} accentClass="border-l-teal-500" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Settled tab */}
        {activeTab === 'settled' && (
          <>
            {loadingSettled ? (
              <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
            ) : error ? (
              <div className="text-center py-10 text-red-500 text-sm">{error}</div>
            ) : settled.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No settled entries yet" subtitle="Entries you mark as settled will appear here." />
            ) : (
              <div className="space-y-2">
                {settled.map(entry => (
                  <SettledRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
