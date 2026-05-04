'use strict'
const express = require('express')
const router = express.Router()
const db = require('../db/database')

function getPriorMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getCutoff() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)
}

// GET /api/predictable?month=YYYY-MM
router.get('/', (req, res) => {
  try {
    const { month } = req.query
    if (!month) return res.status(400).json({ success: false, error: 'month required' })

    // Read active categories from DB table (seeded by admin route)
    const cats = db.prepare('SELECT name FROM fixed_expense_categories WHERE is_active=1 ORDER BY sort_order ASC, name ASC').all().map(r => r.name)

    // Auto-seed one row per category if none exist for this month
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM predictable_expenses WHERE month_key=?').get(month)
    if (existing.cnt === 0 && cats.length > 0) {
      const insert = db.prepare('INSERT INTO predictable_expenses (month_key, category, actual, notes) VALUES (?, ?, 0, NULL)')
      db.transaction(() => { for (const cat of cats) insert.run(month, cat) })()
    }

    const rows = db.prepare('SELECT id, month_key, category, actual, notes, date FROM predictable_expenses WHERE month_key=? ORDER BY id ASC').all(month)
    res.json({ success: true, data: { rows, categories: cats } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/predictable/copy-from-prev — must be before /:id
// Body: { month, ids?: number[] }  — ids restricts which prior-month rows to copy
router.post('/copy-from-prev', (req, res) => {
  try {
    const { month, ids } = req.body
    if (!month) return res.status(400).json({ success: false, error: 'month required' })
    const prior = getPriorMonthKey(month)
    let rows
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const ph = ids.map(() => '?').join(', ')
      rows = db.prepare(`SELECT category, actual, notes, date FROM predictable_expenses WHERE month_key=? AND id IN (${ph})`).all(prior, ...ids)
    } else {
      rows = db.prepare('SELECT category, actual, notes, date FROM predictable_expenses WHERE month_key=?').all(prior)
    }
    const insert = db.prepare('INSERT INTO predictable_expenses (month_key, category, actual, notes) VALUES (?, ?, ?, ?)')
    db.transaction(() => { for (const r of rows) insert.run(month, r.category, r.actual, r.notes) })()
    res.json({ success: true, data: { count: rows.length } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/predictable
router.post('/', (req, res) => {
  try {
    const { category, actual, notes, date } = req.body
    if (!category || actual == null) return res.status(400).json({ success: false, error: 'category and actual required' })
    if (!req.body.month_key && !date) return res.status(400).json({ success: false, error: 'month_key or date required' })
    const monthKey = req.body.month_key || date.slice(0, 7)
    const result = db.prepare('INSERT INTO predictable_expenses (month_key, category, actual, notes, date) VALUES (?, ?, ?, ?, ?)').run(monthKey, category, actual, notes || null, date || null)
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PUT /api/predictable/:id
router.put('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT id, actual, notes, date FROM predictable_expenses WHERE id=?').get(req.params.id)
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    const actual = req.body.actual !== undefined ? req.body.actual : row.actual
    const notes  = req.body.notes  !== undefined ? req.body.notes  : row.notes
    const date   = req.body.date   !== undefined ? req.body.date   : row.date
    db.prepare("UPDATE predictable_expenses SET actual=?, notes=?, date=?, updated_at=datetime('now') WHERE id=?").run(actual, notes || null, date || null, req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/predictable/:id
router.delete('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT id, month_key FROM predictable_expenses WHERE id=?').get(req.params.id)
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    if (row.month_key < getCutoff()) return res.status(403).json({ success: false, error: `Cannot delete records from ${row.month_key}` })
    db.prepare('DELETE FROM predictable_expenses WHERE id=?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
