const express = require('express')
const router  = express.Router()
const db      = require('../db/database')

const ALL_CATEGORIES = [
  'Hypermarket','Restaurants','Fuel','Transport expenses','Hospital & medicines',
  'Purchases','Entertainment','Joy Activities','Gifts','Trip expenses','Haircut',
  'Subscriptions','Other Debits','Interest rates','Rec Activities','Avoidable expenses',
  'Miscellaneous','House Rental','Insurances','Home Expenses (India)','Offerings',
  'Tithe','Investments','Savings','EB bill payment','Car loan / EMI',
  'Car wash & service','Transfers','Mobile bill payment',
]

// GET /api/budget?month=YYYY-MM
// Returns all categories with target (0 if unset) and actual spending for the month.
// Sort: non-zero target or actual first (by actual DESC), then remaining alphabetically.
router.get('/', (req, res) => {
  try {
    const { month } = req.query
    if (!month) return res.status(400).json({ success: false, error: 'month param required (YYYY-MM)' })

    // Fetch all budget targets for the month
    const targetRows = db.prepare(
      'SELECT category, target FROM budget_targets WHERE month_key = ?'
    ).all(month)
    const targetMap = {}
    for (const row of targetRows) targetMap[row.category] = row.target

    // Actuals from expenses table aggregated by category
    const expActualRows = db.prepare(
      'SELECT category, SUM(amount) AS total FROM expenses WHERE month_key = ? GROUP BY category'
    ).all(month)
    const actualMap = {}
    for (const row of expActualRows) actualMap[row.category] = (actualMap[row.category] || 0) + row.total

    // Actuals from credit_card_purchases — use amount directly
    const ccActualRows = db.prepare(
      'SELECT category, SUM(amount) AS total FROM credit_card_purchases WHERE month_key = ? GROUP BY category'
    ).all(month)
    for (const row of ccActualRows) actualMap[row.category] = (actualMap[row.category] || 0) + row.total

    // Merge into result rows
    const data = ALL_CATEGORIES.map(category => ({
      category,
      target: targetMap[category] ?? 0,
      actual: actualMap[category] ?? 0,
    }))

    // Sort: non-zero target or actual first (by actual DESC), then the rest alphabetically
    data.sort((a, b) => {
      const aActive = a.target > 0 || a.actual > 0
      const bActive = b.target > 0 || b.actual > 0
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1
      if (aActive && bActive) return b.actual - a.actual
      return a.category.localeCompare(b.category)
    })

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PUT /api/budget — upsert a single category target
// Body: { month_key, category, target }
router.put('/', (req, res) => {
  try {
    const { month_key, category, target } = req.body
    if (!month_key || !category || target == null)
      return res.status(400).json({ success: false, error: 'month_key, category, and target are required' })
    if (typeof target !== 'number' || isNaN(target) || target < 0)
      return res.status(400).json({ success: false, error: 'target must be a non-negative number' })
    if (!ALL_CATEGORIES.includes(category))
      return res.status(400).json({ success: false, error: `Unknown category: ${category}` })

    db.prepare(
      'INSERT OR REPLACE INTO budget_targets (month_key, category, target) VALUES (?, ?, ?)'
    ).run(month_key, category, target)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
