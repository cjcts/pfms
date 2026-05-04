const express = require('express')
const router = express.Router()
const db = require('../db/database')

router.get('/', (req, res) => {
  const { month } = req.query
  if (!month) return res.status(400).json({ success: false, error: 'month required' })

  const totalExpenses    = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE month_key=?').get(month).total
  const totalIncome      = db.prepare('SELECT COALESCE(SUM(actual),0) as total FROM income WHERE month_key=?').get(month).total
  const totalPredictable = db.prepare('SELECT COALESCE(SUM(actual),0) as total FROM predictable_expenses WHERE month_key=?').get(month).total
  const ccTotal          = db.prepare(
    'SELECT COALESCE(SUM(COALESCE(my_share,amount)),0) as total FROM credit_card_purchases WHERE month_key=?'
  ).get(month).total

  const expByCategory = db.prepare(
    'SELECT category, SUM(amount) as total FROM expenses WHERE month_key=? GROUP BY category'
  ).all(month)

  const ccByCategory = db.prepare(
    'SELECT category, SUM(COALESCE(my_share,amount)) as total FROM credit_card_purchases WHERE month_key=? GROUP BY category'
  ).all(month)

  // Merge expense and CC category totals
  const categoryMap = {}
  for (const row of expByCategory) {
    categoryMap[row.category] = (categoryMap[row.category] ?? 0) + row.total
  }
  for (const row of ccByCategory) {
    categoryMap[row.category] = (categoryMap[row.category] ?? 0) + row.total
  }
  const byCategory = Object.entries(categoryMap)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)

  res.json({
    success: true,
    data: {
      month,
      totalExpenses: totalExpenses + totalPredictable + ccTotal,
      totalIncome,
      balance: totalIncome - totalExpenses - totalPredictable - ccTotal,
      byCategory,
    }
  })
})

// GET /api/summary/history?months=12
router.get('/history', (req, res) => {
  const rawMonths = parseInt(req.query.months)
  const months = Math.min(Math.max(isNaN(rawMonths) ? 12 : rawMonths, 1), 36)
  const now = new Date()
  const result = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const expenses    = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM expenses WHERE month_key=?').get(monthKey).t
    const predictable = db.prepare('SELECT COALESCE(SUM(actual),0) as t FROM predictable_expenses WHERE month_key=?').get(monthKey).t
    const income      = db.prepare('SELECT COALESCE(SUM(actual),0) as t FROM income WHERE month_key=?').get(monthKey).t
    const ccPurchases = db.prepare('SELECT COALESCE(SUM(COALESCE(my_share,amount)),0) as t FROM credit_card_purchases WHERE month_key=?').get(monthKey).t

    const totalExpenses = expenses + predictable + ccPurchases
    result.push({
      month: monthKey,
      totalExpenses,
      totalIncome: income,
      balance: income - totalExpenses,
    })
  }

  res.json({ success: true, data: result })
})

module.exports = router
