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

// GET /api/income?month=YYYY-MM
// Auto-seeds ONLY Opening Balance (with carry-forward from prior month).
// Returns { rows, categories } where categories = active income_categories names.
router.get('/', (req, res) => {
  try {
    const { month } = req.query
    if (!month) return res.status(400).json({ success: false, error: 'month required' })

    // Auto-seed Opening Balance if no rows exist for this month
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM income WHERE month_key = ?').get(month)
    if (existing.cnt === 0) {
      const prior = getPriorMonthKey(month)
      const priorOB      = db.prepare("SELECT COALESCE(actual,0) as t FROM income WHERE month_key=? AND source='Opening Balance'").get(prior)?.t ?? 0
      const priorOther   = db.prepare("SELECT COALESCE(SUM(actual),0) as t FROM income WHERE month_key=? AND source != 'Opening Balance'").get(prior).t
      const priorExp     = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM expenses WHERE month_key=?').get(prior).t
      const priorPred    = db.prepare('SELECT COALESCE(SUM(actual),0) as t FROM predictable_expenses WHERE month_key=?').get(prior).t
      const priorCC      = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM credit_card_purchases WHERE month_key=?').get(prior).t
      const closingBal   = Math.round((priorOB + priorOther - priorExp - priorPred - priorCC) * 100) / 100
      db.prepare('INSERT INTO income (month_key, source, actual, notes) VALUES (?, ?, ?, NULL)').run(month, 'Opening Balance', closingBal)
    }

    const rows = db.prepare('SELECT id, month_key, source, actual, notes, date FROM income WHERE month_key = ? ORDER BY id ASC').all(month)
    const categories = db.prepare("SELECT name FROM income_categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC").all().map(r => r.name)
    res.json({ success: true, data: { rows, categories } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/income — create a new income entry
router.post('/', (req, res) => {
  try {
    const { date, source, actual, notes } = req.body
    if (!date || !source || actual == null) return res.status(400).json({ success: false, error: 'date, source, and actual are required' })
    const monthKey = date.slice(0, 7)
    const result = db.prepare('INSERT INTO income (month_key, source, actual, notes, date) VALUES (?, ?, ?, ?, ?)').run(monthKey, source, actual, notes || null, date)
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PUT /api/income/:id — partial update: only supplied fields overwrite existing values
router.put('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT id, date, source, actual, notes FROM income WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    const date   = req.body.date   !== undefined ? (req.body.date   || null) : row.date
    const source = req.body.source !== undefined ? (req.body.source || row.source) : row.source
    const actual = req.body.actual !== undefined ? (req.body.actual ?? row.actual) : row.actual
    const notes  = req.body.notes  !== undefined ? (req.body.notes  || null) : row.notes
    db.prepare('UPDATE income SET date=?, source=?, actual=?, notes=? WHERE id=?').run(date, source, actual, notes, req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/income/:id  (3-month age policy; Opening Balance is protected)
router.delete('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT id, source, month_key FROM income WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    if (row.source === 'Opening Balance') return res.status(403).json({ success: false, error: 'Opening Balance cannot be deleted' })
    if (row.month_key < getCutoff()) return res.status(403).json({ success: false, error: `Cannot delete records from ${row.month_key}` })
    db.prepare('DELETE FROM income WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/income/copy-from-prev — copy prior month non-OB rows into body.month
// MUST be registered before /:id to avoid Express matching "copy-from-prev" as an id
// Body: { month, ids?: number[] }  — ids restricts which prior-month rows to copy
router.post('/copy-from-prev', (req, res) => {
  try {
    const { month, ids } = req.body
    if (!month) return res.status(400).json({ success: false, error: 'month required' })
    const prior = getPriorMonthKey(month)
    let rows
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const ph = ids.map(() => '?').join(', ')
      rows = db.prepare(`SELECT source, actual, notes FROM income WHERE month_key=? AND source != 'Opening Balance' AND id IN (${ph})`).all(prior, ...ids)
    } else {
      rows = db.prepare("SELECT source, actual, notes FROM income WHERE month_key = ? AND source != 'Opening Balance'").all(prior)
    }
    const insert = db.prepare('INSERT INTO income (month_key, source, actual, notes) VALUES (?, ?, ?, ?)')
    const insertAll = db.transaction((rows) => { for (const r of rows) insert.run(month, r.source, r.actual, r.notes) })
    insertAll(rows)
    res.json({ success: true, data: { count: rows.length } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
