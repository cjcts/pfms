import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Wallet, BarChart2 } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { formatCAD, formatMonthLabel } from '../utils/formatters'

// Abbreviates 'YYYY-MM' to "Apr '26"
function shortMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  const mon = date.toLocaleDateString('en-CA', { month: 'short' })
  return `${mon} '${String(y).slice(2)}`
}

function cadTooltipFormatter(value) {
  return [formatCAD(value), '']
}

function AreaTooltipContent({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatCAD(entry.value)}
        </p>
      ))}
    </div>
  )
}

function BalanceTooltipContent({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div className="bg-white border border-gray-200 rounded shadow-md p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      <p style={{ color: value >= 0 ? '#16a34a' : '#ef4444' }}>
        Balance: {formatCAD(value)}
      </p>
    </div>
  )
}

function SavingsRateBadge({ rate }) {
  if (rate >= 20) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
        {rate.toFixed(1)}%
      </span>
    )
  }
  if (rate >= 0) {
    return (
      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
        {rate.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
      {rate.toFixed(1)}%
    </span>
  )
}

export default function History() {
  const [historyData, setHistoryData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const months = 12

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/summary/history?months=${months}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (!json.success) throw new Error(json.error || 'Failed to load history')
        setHistoryData(json.data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Compute summary averages
  const avgIncome =
    historyData.length > 0
      ? historyData.reduce((sum, r) => sum + r.totalIncome, 0) / historyData.length
      : 0
  const avgExpenses =
    historyData.length > 0
      ? historyData.reduce((sum, r) => sum + r.totalExpenses, 0) / historyData.length
      : 0
  const avgBalance = avgIncome - avgExpenses

  // Chart data: oldest first, with short label
  const chartData = historyData.map((row) => ({
    ...row,
    label: shortMonthLabel(row.month),
  }))

  // Table data: newest first
  const tableData = [...historyData].reverse()

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Trends</h1>
        <p className="text-sm text-gray-500 mb-6">Last {months} months</p>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 text-sm">
          Error loading history: {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trends</h1>
        <p className="text-sm text-gray-500 mt-0.5">Last {months} months</p>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="text-sm text-gray-400">Loading summary…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Avg Income */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-5 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-teal-50">
              <TrendingUp className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Avg Monthly Income
              </p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCAD(avgIncome)}</p>
            </div>
          </div>

          {/* Avg Expenses */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-5 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-red-50">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Avg Monthly Expenses
              </p>
              <p className="text-xl font-bold text-gray-900 mt-1">{formatCAD(avgExpenses)}</p>
            </div>
          </div>

          {/* Avg Balance */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-5 flex items-start gap-4">
            <div className={`p-2 rounded-lg ${avgBalance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <Wallet className={`w-5 h-5 ${avgBalance >= 0 ? 'text-green-600' : 'text-red-500'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Avg Monthly Balance
              </p>
              <p
                className={`text-xl font-bold mt-1 ${
                  avgBalance >= 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {formatCAD(avgBalance)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Income vs Expenses Area Chart */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Income vs Expenses — 12 Month Trend
        </h2>
        {loading ? (
          <div className="text-sm text-gray-400 h-48 flex items-center justify-center">
            Loading chart…
          </div>
        ) : historyData.length === 0 ? (
          <EmptyState icon={BarChart2} title="No historical data yet" subtitle="Your monthly summaries will build up as you record expenses." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip content={<AreaTooltipContent />} />
              <Legend
                wrapperStyle={{ fontSize: '13px', paddingTop: '12px' }}
                formatter={(value) => (value === 'totalIncome' ? 'Income' : 'Expenses')}
              />
              <Area
                type="monotone"
                dataKey="totalIncome"
                name="totalIncome"
                stroke="#0d9488"
                strokeWidth={2}
                fill="url(#gradIncome)"
                dot={{ r: 3, fill: '#0d9488' }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="totalExpenses"
                name="totalExpenses"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#gradExpenses)"
                dot={{ r: 3, fill: '#ef4444' }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Balance Bar Chart */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Monthly Balance</h2>
        {loading ? (
          <div className="text-sm text-gray-400 h-48 flex items-center justify-center">
            Loading chart…
          </div>
        ) : historyData.length === 0 ? (
          <EmptyState icon={BarChart2} title="No historical data yet" subtitle="Your monthly summaries will build up as you record expenses." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip content={<BalanceTooltipContent />} />
              <Bar dataKey="balance" name="Balance" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.balance >= 0 ? '#16a34a' : '#ef4444'}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Month-by-Month Table */}
      <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Month-by-Month Breakdown</h2>
        {loading ? (
          <div className="text-sm text-gray-400">Loading table…</div>
        ) : historyData.length === 0 ? (
          <EmptyState icon={BarChart2} title="No historical data yet" subtitle="Your monthly summaries will build up as you record expenses." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Month
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Income
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Expenses
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Balance
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Savings Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => {
                  const savingsRate =
                    row.totalIncome > 0 ? (row.balance / row.totalIncome) * 100 : 0
                  const isNegativeBalance = row.balance < 0
                  return (
                    <tr
                      key={row.month}
                      className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        isNegativeBalance ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-medium text-gray-900">
                        {formatMonthLabel(row.month)}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-700">
                        {formatCAD(row.totalIncome)}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-700">
                        {formatCAD(row.totalExpenses)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-semibold ${
                          row.balance >= 0 ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {formatCAD(row.balance)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <SavingsRateBadge rate={savingsRate} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
