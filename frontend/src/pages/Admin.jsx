import { useState, useEffect, useCallback } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import { getCategories, addCategory, toggleCategory, deleteCategory, getCleanDataPreview, cleanData, getSettings, updateSetting } from '../api/admin'

const TABS = [
  { key: 'expense', label: 'Expense Categories' },
  { key: 'income', label: 'Income Categories' },
  { key: 'fixed', label: 'Fixed Categories' },
  { key: 'recipients', label: 'Recipients' },
  { key: 'member', label: 'Members' },
  { key: 'settings', label: 'Settings' },
  { key: 'clean', label: 'Clean Data' },
]

// ── Category tab ──────────────────────────────────────────────────────────────

function CategoryTab({ type }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getCategories(type)
      .then(data => { setItems(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [type])

  useEffect(() => { load() }, [load])

  async function handleToggle(id, currentActive) {
    try {
      if (currentActive) {
        // Deactivating: backend decides hard vs soft delete
        await deleteCategory(type, id)
      } else {
        // Reactivating
        await toggleCategory(type, id, true)
      }
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) { setAddError('Name is required'); return }
    setAdding(true)
    setAddError('')
    try {
      await addCategory(type, name)
      setNewName('')
      load()
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
  if (error) return <div className="py-4 px-4 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Active</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No categories yet.</td></tr>
            ) : (
              items.map(item => (
                <tr key={item.id} className="bg-white hover:bg-gray-50 transition-colors">
                  <td className={`px-4 py-3 font-medium ${item.is_active ? 'text-gray-900' : 'line-through text-gray-400'}`}>
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggle(item.id, item.is_active)}
                      className={`text-xs px-3 py-1 rounded font-medium transition-colors ${
                        item.is_active
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                      }`}
                    >
                      {item.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add new */}
      <form onSubmit={handleAdd} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="New category name"
          value={newName}
          onChange={e => { setNewName(e.target.value); setAddError('') }}
          className={`flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
            addError ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
        />
        <button
          type="submit"
          disabled={adding}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>
      {addError && <p className="mt-1 text-xs text-red-500">{addError}</p>}
    </div>
  )
}

// ── Clean Data tab ────────────────────────────────────────────────────────────

function CleanDataTab() {
  const [month, setMonth] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [confirmClean, setConfirmClean] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanSuccess, setCleanSuccess] = useState(false)

  async function handlePreview() {
    if (!month) return
    setPreviewLoading(true)
    setPreviewError(null)
    setPreview(null)
    try {
      const data = await getCleanDataPreview(month)
      setPreview(data)
    } catch (err) {
      setPreviewError(err.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleClean() {
    setCleaning(true)
    try {
      await cleanData(month)
      setCleanSuccess(true)
      setPreview(null)
      setTimeout(() => setCleanSuccess(false), 3000)
    } catch (err) {
      setPreviewError(err.message)
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div>
      <ConfirmModal
        isOpen={confirmClean}
        title={`Delete all data for ${month}?`}
        message="This will permanently remove all records for this month. This cannot be undone."
        confirmLabel="Delete All"
        onConfirm={() => { setConfirmClean(false); handleClean() }}
        onCancel={() => setConfirmClean(false)}
      />

      <div className="flex items-center gap-3 mb-4">
        <input
          type="month"
          value={month}
          onChange={e => { setMonth(e.target.value); setPreview(null) }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          onClick={handlePreview}
          disabled={!month || previewLoading}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {previewLoading ? 'Loading…' : 'Preview'}
        </button>
      </div>

      {previewError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{previewError}</div>
      )}

      {cleanSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          All data for {month} has been deleted.
        </div>
      )}

      {preview && (
        <div>
          <div className="overflow-x-auto rounded-lg border border-gray-100 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Table</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(preview).map(([table, count]) => (
                  <tr key={table} className="bg-white">
                    <td className="px-4 py-3 text-gray-900 font-medium">{table}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => setConfirmClean(true)}
            disabled={cleaning}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {cleaning ? 'Deleting…' : `Delete all data for ${month}`}
          </button>
        </div>
      )}

      {!preview && !previewLoading && !cleanSuccess && (
        <p className="text-sm text-gray-400">Select a month and click Preview to see what will be deleted.</p>
      )}
    </div>
  )
}

// ── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rpp, setRpp] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSettings()
      .then(data => {
        setSettings(data)
        setRpp(data.records_per_page ?? '3')
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    const val = parseInt(rpp, 10)
    if (isNaN(val) || val < 1 || val > 50) { setError('Enter a number between 1 and 50'); return }
    setSaving(true)
    setError(null)
    try {
      await updateSetting('records_per_page', String(val))
      setSettings(s => ({ ...s, records_per_page: String(val) }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Loading…</div>

  return (
    <div className="max-w-sm">
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pull-from-prev panel — records per page
          </label>
          <p className="text-xs text-gray-400 mb-2">
            How many records are shown per page in the "Pull from previous month" panel on Expenses and Credit Card.
          </p>
          <input
            type="number"
            min="1"
            max="50"
            value={rpp}
            onChange={e => setRpp(e.target.value)}
            className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved</span>}
        </div>
      </form>
    </div>
  )
}

// ── Main Admin page ───────────────────────────────────────────────────────────

export default function Admin() {
  const [activeTab, setActiveTab] = useState('expense')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage categories, recipients, and data.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white rounded-xl shadow-sm border border-gray-100 p-1 mb-6 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-teal-600 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
        {activeTab === 'expense' && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Expense Categories</h2>
            <CategoryTab type="expense" />
          </>
        )}
        {activeTab === 'income' && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Income Categories</h2>
            <CategoryTab type="income" />
          </>
        )}
        {activeTab === 'fixed' && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Fixed Categories</h2>
            <CategoryTab type="fixed" />
          </>
        )}
        {activeTab === 'recipients' && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Recipients</h2>
            <CategoryTab type="recipient" />
          </>
        )}
        {activeTab === 'member' && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Household Members</h2>
            <p className="text-sm text-gray-500 mb-4">Members can be tagged on expenses and credit card purchases to group spending by person.</p>
            <CategoryTab type="member" />
          </>
        )}
        {activeTab === 'settings' && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Settings</h2>
            <SettingsTab />
          </>
        )}
        {activeTab === 'clean' && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Clean Data</h2>
            <CleanDataTab />
          </>
        )}
      </div>
    </div>
  )
}
