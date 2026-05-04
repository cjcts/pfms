import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, PieChart, Pie, Cell,
  Tooltip, Legend, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Receipt, X } from 'lucide-react'

import { formatCAD, formatDate, formatMonthLabel } from '../utils/formatters'
import { useSelectedMonth } from '../utils/useSelectedMonth'
import { CATEGORY_COLORS } from '../utils/categories'
import { getSummary, getSummaryHistory } from '../api/summary'
import { getExpenses } from '../api/expenses'
import { getCreditCard } from '../api/creditCard'
import { getReminders, createReminder } from '../api/reminders'

// ─── helpers ────────────────────────────────────────────────────────────────

function shortMonth(monthKey) {
  const [y, m] = monthKey.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-CA', { month: 'short' })
}

function categoryColor(cat) {
  return CATEGORY_COLORS[cat] ?? '#cccccc'
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, colorClass, subLabel }) {
  return (
    <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        <span className={`p-2 rounded-lg ${colorClass}`}>
          <Icon size={18} />
        </span>
      </div>
      <span className="text-2xl font-semibold text-gray-900 tracking-tight">{value}</span>
      {subLabel && <span className="text-xs text-gray-400">{subLabel}</span>}
    </div>
  )
}

function SectionSkeleton({ label }) {
  return (
    <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-5">
      <p className="text-sm text-gray-400 animate-pulse">{label}</p>
    </div>
  )
}

function SectionError({ message }) {
  return (
    <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-5">
      <p className="text-sm text-red-500">{message}</p>
    </div>
  )
}

// Custom tooltip for the area chart
function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCAD(p.value)}
        </p>
      ))}
    </div>
  )
}

// Custom tooltip for pie chart
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-medium text-gray-700">{name}</p>
      <p className="text-gray-900">{formatCAD(value)}</p>
    </div>
  )
}

// ─── category drill-down panel ───────────────────────────────────────────────

function DrillDownPanel({ category, selectedMonth, allExpenses, onClose }) {
  const [ccPurchases, setCcPurchases] = useState([])
  const [ccLoading, setCcLoading] = useState(true)
  const [ccError, setCcError] = useState(null)

  useEffect(() => {
    setCcLoading(true)
    setCcError(null)
    getCreditCard(selectedMonth)
      .then((data) => {
        // getCreditCard returns an object with purchases array
        const purchases = Array.isArray(data) ? data : (data.purchases ?? [])
        setCcPurchases(purchases)
      })
      .catch((err) => setCcError(err.message))
      .finally(() => setCcLoading(false))
  }, [selectedMonth, category])

  const expenseRows = allExpenses
    .filter((e) => e.category === category)
    .map((e) => ({
      date: e.date,
      source: 'Expense',
      description: e.description,
      amount: e.amount,
    }))

  const ccRows = ccPurchases
    .filter((p) => p.category === category)
    .map((p) => ({
      date: p.date,
      source: 'CC',
      description: p.description,
      amount: p.my_share ?? p.amount,
    }))

  const rows = [...expenseRows, ...ccRows].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle"
            style={{ backgroundColor: categoryColor(category) }}
          />
          {category} — {formatMonthLabel(selectedMonth)}
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Close drill-down"
        >
          <X size={16} />
        </button>
      </div>

      {ccLoading ? (
        <p className="text-sm text-gray-400 animate-pulse">Loading entries…</p>
      ) : ccError ? (
        <p className="text-sm text-red-500">Could not load credit card data: {ccError}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No entries in this category.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.source === 'CC'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      {row.source}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-gray-900 max-w-[240px] truncate">
                    {row.description}
                  </td>
                  <td className="py-2.5 text-right font-medium text-gray-900">
                    {formatCAD(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useSelectedMonth()

  // summary state
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(null)

  // history state (loaded once on mount)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(null)

  // recent expenses state
  const [expenses, setExpenses] = useState([])
  const [allExpenses, setAllExpenses] = useState([])
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [expensesError, setExpensesError] = useState(null)

  // drill-down state
  const [drillCategory, setDrillCategory] = useState(null)

  // reminders state
  const [alerts, setAlerts] = useState([])
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_alerts') || '{}') } catch { return {} }
  })
  const [showAddReminder, setShowAddReminder] = useState(false)
  const [reminderForm, setReminderForm] = useState({ title: '', due_date: '' })
  const [reminderError, setReminderError] = useState('')

  // load summary + recent expenses when month changes
  useEffect(() => {
    setSummaryLoading(true)
    setSummaryError(null)
    setSummary(null)

    setExpensesLoading(true)
    setExpensesError(null)
    setExpenses([])
    setAllExpenses([])

    // Reset drill-down when month changes
    setDrillCategory(null)

    getSummary(selectedMonth)
      .then(setSummary)
      .catch((err) => setSummaryError(err.message))
      .finally(() => setSummaryLoading(false))

    getExpenses(selectedMonth)
      .then((data) => {
        setAllExpenses(data)
        setExpenses(data.slice(0, 5))
      })
      .catch((err) => setExpensesError(err.message))
      .finally(() => setExpensesLoading(false))
  }, [selectedMonth])

  // load history once on mount
  useEffect(() => {
    getSummaryHistory(12)
      .then(setHistory)
      .catch((err) => setHistoryError(err.message))
      .finally(() => setHistoryLoading(false))
  }, [])

  // fetch alerts on mount
  useEffect(() => {
    getReminders().then(setAlerts).catch(() => {})
  }, [])

  // dismiss handler
  const dismissAlert = (alertId) => {
    const today = new Date().toISOString().slice(0, 10)
    const key = `${alertId}_${today}`
    const next = { ...dismissed, [key]: true }
    setDismissed(next)
    localStorage.setItem('dismissed_alerts', JSON.stringify(next))
  }

  const isDismissed = (alertId) => {
    const today = new Date().toISOString().slice(0, 10)
    return dismissed[`${alertId}_${today}`] === true
  }

  const visibleAlerts = alerts.filter(a => !isDismissed(a.id))

  const handleAddReminder = async (e) => {
    e.preventDefault()
    setReminderError('')
    if (!reminderForm.title.trim()) { setReminderError('Title is required'); return }
    if (!reminderForm.due_date) { setReminderError('Due date is required'); return }
    try {
      await createReminder(reminderForm)
      setReminderForm({ title: '', due_date: '' })
      setReminderError('')
      setShowAddReminder(false)
      getReminders().then(setAlerts).catch(() => {})
    } catch (err) {
      setReminderError(err.message || 'Failed to add reminder')
    }
  }

  // ── derived values ────────────────────────────────────────────────────────
  const totalIncome = summary?.totalIncome ?? 0
  const totalExpenses = summary?.totalExpenses ?? 0
  const balance = summary?.balance ?? 0
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0

  const pieData = (summary?.byCategory ?? []).filter((r) => r.total > 0)
  const top5 = [...pieData].sort((a, b) => b.total - a.total).slice(0, 5)
  const top5Max = top5[0]?.total ?? 1

  const trendData = history.map((row) => ({
    month: shortMonth(row.month),
    Income: row.totalIncome,
    Expenses: row.totalExpenses,
  }))

  // ── stat card helpers ─────────────────────────────────────────────────────
  const expensesColor =
    totalExpenses > totalIncome
      ? 'bg-red-50 text-red-500'
      : 'bg-gray-100 text-gray-500'

  const balanceColor =
    balance >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'

  const savingsColor =
    savingsRate >= 20
      ? 'bg-green-50 text-green-600'
      : savingsRate >= 0
      ? 'bg-amber-50 text-amber-500'
      : 'bg-red-50 text-red-500'

  const savingsTextColor =
    savingsRate >= 20
      ? 'text-green-600'
      : savingsRate >= 0
      ? 'text-amber-500'
      : 'text-red-500'

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatMonthLabel(selectedMonth)}</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>

      {/* Stat cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white shadow-sm border border-gray-100 rounded-xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : summaryError ? (
        <div className="mb-6">
          <SectionError message={`Summary error: ${summaryError}`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Income"
            value={formatCAD(totalIncome)}
            icon={TrendingUp}
            colorClass="bg-teal-50 text-teal-600"
          />
          <StatCard
            label="Total Expenses"
            value={formatCAD(totalExpenses)}
            icon={TrendingDown}
            colorClass={expensesColor}
            subLabel={totalExpenses > totalIncome ? 'Over income' : undefined}
          />
          <StatCard
            label="Balance"
            value={formatCAD(balance)}
            icon={Wallet}
            colorClass={balanceColor}
          />
          <StatCard
            label="Savings Rate"
            value={
              <span className={savingsTextColor}>
                {totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : '—'}
              </span>
            }
            icon={PiggyBank}
            colorClass={savingsColor}
            subLabel={savingsRate >= 20 ? 'On track' : savingsRate >= 0 ? 'Below target' : 'Negative savings'}
          />
        </div>
      )}

      {/* Spending charts */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
          <SectionSkeleton label="Loading spending breakdown…" />
          <SectionSkeleton label="Loading top categories…" />
        </div>
      ) : summaryError ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">

          {/* Pie chart — 3/5 width */}
          <div className="lg:col-span-3 bg-white shadow-sm border border-gray-100 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Spending by Category</h2>
            {pieData.length === 0 ? (
              <p className="text-sm text-gray-400">No expense data for this month.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={52}
                    onClick={(entry) => setDrillCategory(entry.category)}
                    style={{ cursor: 'pointer' }}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={categoryColor(entry.category)}
                        opacity={drillCategory && drillCategory !== entry.category ? 0.4 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span className="text-xs text-gray-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top 5 ranked list — 2/5 width */}
          <div className="lg:col-span-2 bg-white shadow-sm border border-gray-100 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Top 5 Categories</h2>
            {top5.length === 0 ? (
              <p className="text-sm text-gray-400">No data yet.</p>
            ) : (
              <ol className="space-y-3">
                {top5.map((item, idx) => (
                  <li
                    key={item.category}
                    onClick={() => setDrillCategory(item.category)}
                    className="cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-medium truncate max-w-[60%] transition-colors ${
                          drillCategory === item.category
                            ? 'text-teal-700'
                            : 'text-gray-700 group-hover:text-teal-600'
                        }`}
                      >
                        <span className="text-gray-400 mr-1">{idx + 1}.</span>
                        {item.category}
                      </span>
                      <span className="text-xs font-semibold text-gray-900">
                        {formatCAD(item.total)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-opacity"
                        style={{
                          width: `${(item.total / top5Max) * 100}%`,
                          backgroundColor: categoryColor(item.category),
                          opacity: drillCategory && drillCategory !== item.category ? 0.35 : 1,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* Category drill-down panel */}
      {drillCategory && (
        <DrillDownPanel
          category={drillCategory}
          selectedMonth={selectedMonth}
          allExpenses={allExpenses}
          onClose={() => setDrillCategory(null)}
        />
      )}

      {/* Trend chart */}
      <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">12-Month Trend</h2>
        {historyLoading ? (
          <p className="text-sm text-gray-400 animate-pulse">Loading trend data…</p>
        ) : historyError ? (
          <p className="text-sm text-red-500">{historyError}</p>
        ) : trendData.length === 0 ? (
          <p className="text-sm text-gray-400">No historical data available yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={44}
              />
              <Tooltip content={<TrendTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-gray-600">{value}</span>
                )}
              />
              <Area
                type="monotone"
                dataKey="Income"
                stroke="#0d9488"
                strokeWidth={2}
                fill="url(#gradIncome)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="Expenses"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#gradExpenses)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent expenses / category filter */}
      <div className="bg-white shadow-sm border border-gray-100 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          {drillCategory ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: categoryColor(drillCategory) }}
              />
              <h2 className="text-sm font-semibold text-gray-700">{drillCategory}</h2>
              <button
                onClick={() => setDrillCategory(null)}
                className="ml-1 text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-0.5"
              >
                <X size={12} />
                Clear
              </button>
            </div>
          ) : (
            <h2 className="text-sm font-semibold text-gray-700">Recent Expenses</h2>
          )}
          {!drillCategory && (
            <Link to="/expenses" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
              View all →
            </Link>
          )}
        </div>

        {expensesLoading ? (
          <p className="text-sm text-gray-400 animate-pulse">Loading recent expenses…</p>
        ) : expensesError ? (
          <p className="text-sm text-red-500">{expensesError}</p>
        ) : (() => {
          const displayRows = drillCategory
            ? allExpenses.filter((e) => e.category === drillCategory)
            : expenses

          if (displayRows.length === 0) {
            return drillCategory ? (
              <p className="text-sm text-gray-400 py-4 text-center">No expenses in this category.</p>
            ) : (
              <div className="flex flex-col items-center py-8 text-gray-400 gap-2">
                <Receipt size={32} className="opacity-40" />
                <p className="text-sm font-medium">No expenses recorded for {formatMonthLabel(selectedMonth)}</p>
                <p className="text-xs">Head to Add Expenses to get started.</p>
              </div>
            )
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((exp) => (
                    <tr key={exp.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                        {formatDate(exp.date)}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-900 max-w-[200px] truncate">
                        {exp.description}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-medium"
                          style={{ backgroundColor: categoryColor(exp.category) }}
                        >
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-medium text-gray-900">
                        {formatCAD(exp.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>

      {/* Reminders & Alerts */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Reminders &amp; Alerts</h2>
          <button onClick={() => setShowAddReminder(!showAddReminder)} className="text-sm text-teal-600 hover:text-teal-700">+ Add reminder</button>
        </div>

        {showAddReminder && (
          <form onSubmit={handleAddReminder} noValidate className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Reminder title"
                value={reminderForm.title}
                onChange={e => { setReminderForm({...reminderForm, title: e.target.value}); setReminderError('') }}
                className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${reminderError && !reminderForm.title.trim() ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              <input
                type="date"
                value={reminderForm.due_date}
                onChange={e => { setReminderForm({...reminderForm, due_date: e.target.value}); setReminderError('') }}
                className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${reminderError && !reminderForm.due_date ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              <button type="submit" className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700">Add</button>
            </div>
            {reminderError && <p className="mt-1 text-xs text-red-500">{reminderError}</p>}
          </form>
        )}

        {visibleAlerts.length === 0 ? (
          <p className="text-sm text-gray-500">No active reminders or alerts.</p>
        ) : (
          <ul className="space-y-2">
            {visibleAlerts.map(alert => (
              <li key={alert.id} className="flex items-start justify-between gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                  {alert.detail && <p className="text-xs text-gray-500">{alert.detail}</p>}
                  {alert.due_date && <p className="text-xs text-gray-400">Due: {alert.due_date}</p>}
                </div>
                <button onClick={() => dismissAlert(alert.id)} className="text-gray-400 hover:text-gray-600 text-xs shrink-0">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
