const express = require('express')
const router  = express.Router()
const db      = require('../db/database')

// GET /api/budget?month=YYYY-MM
// Returns all categories (from admin DB tables) with target and actual for the month.
// Actuals are aggregated from: expenses, credit_card_purchases, predictable_expenses, home_expenses.
// Sort: non-zero target or actual first (by actual DESC), then remaining alphabetically.
router.get('/', (req, res) => {
  try {
    const { month } = req.query
    if (!month) return res.status(400).json({ success: false, error: 'month param required (YYYY-MM)' })

    // Build category list from all admin-managed tables (active entries, deduplicated)
    const expCats   = db.prepare('SELECT name FROM expense_categories   WHERE is_active=1 ORDER BY sort_order ASC, name ASC').all().map(r => r.name)
    const fixedCats = db.prepare('SELECT name FROM fixed_expense_categories WHERE is_active=1 ORDER BY sort_order ASC, name ASC').all().map(r => r.name)
    const homeCats  = db.prepare('SELECT name FROM home_recipients       WHERE is_active=1 ORDER BY sort_order ASC, name ASC').all().map(r => r.name)

    const seen = new Set()
    const allCategories = []
    for (const name of [...expCats, ...fixedCats, ...homeCats]) {
      if (!seen.has(name)) { seen.add(name); allCategories.push(name) }
    }

    // Budget targets for this month (also surfaces deactivated categories that have targets)
    const targetMap = {}
    for (const row of db.prepare('SELECT category, target FROM budget_targets WHERE month_key = ?').all(month)) {
      targetMap[row.category] = row.target
      if (!seen.has(row.category)) { seen.add(row.category); allCategories.push(row.category) }
    }

    // Actuals aggregated from all transaction tables
    const actualMap = {}
    function addActuals(rows) {
      for (const row of rows) {
        actualMap[row.category] = (actualMap[row.category] || 0) + row.total
        if (!seen.has(row.category)) { seen.add(row.category); allCategories.push(row.category) }
      }
    }

    addActuals(db.prepare('SELECT category, SUM(amount)  AS total FROM expenses              WHERE month_key=? GROUP BY category').all(month))
    addActuals(db.prepare('SELECT category, SUM(amount)  AS total FROM credit_card_purchases WHERE month_key=? GROUP BY category').all(month))
    addActuals(db.prepare('SELECT category, SUM(actual)  AS total FROM predictable_expenses  WHERE month_key=? GROUP BY category').all(month))
    // home_expenses uses recipient as the category dimension
    addActuals(db.prepare('SELECT recipient AS category, SUM(amount_cad) AS total FROM home_expenses WHERE month_key=? GROUP BY recipient').all(month))

    const data = allCategories.map(category => ({
      category,
      target: targetMap[category] ?? 0,
      actual: actualMap[category] ?? 0,
    }))

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

    db.prepare('INSERT OR REPLACE INTO budget_targets (month_key, category, target) VALUES (?, ?, ?)').run(month_key, category, target)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
