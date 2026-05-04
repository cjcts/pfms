const express = require('express')
const router = express.Router()
const db = require('../db/database')

// GET /api/expenses/descriptions — unique descriptions ordered by frequency
router.get('/descriptions', (req, res) => {
  const rows = db.prepare(
    'SELECT description FROM expenses GROUP BY description ORDER BY COUNT(*) DESC, description ASC LIMIT 300'
  ).all()
  res.json({ success: true, data: rows.map(r => r.description) })
})

// GET /api/expenses?month=2026-04
router.get('/', (req, res) => {
  const { month } = req.query
  if (!month) return res.status(400).json({ success: false, error: 'month param required (YYYY-MM)' })
  const rows = db.prepare(
    'SELECT id, date, description, category, amount, notes, month_key, member FROM expenses WHERE month_key = ? ORDER BY date DESC'
  ).all(month)
  res.json({ success: true, data: rows })
})

// POST /api/expenses
router.post('/', (req, res) => {
  const { date, description, category, amount, notes, member } = req.body
  if (!date || !description || !category || amount == null)
    return res.status(400).json({ success: false, error: 'date, description, category, amount required' })
  // Reject future dates
  const today = new Date().toISOString().slice(0, 10)
  if (date > today) return res.status(400).json({ success: false, error: 'Cannot enter future dates' })
  const month_key = date.slice(0, 7)
  const result = db.prepare(
    "INSERT INTO expenses (date, description, category, amount, expense_type, notes, month_key, member) VALUES (?, ?, ?, ?, 'daily', ?, ?, ?)"
  ).run(date, description, category, amount, notes || null, month_key, member || null)
  res.status(201).json({ success: true, data: { id: result.lastInsertRowid } })
})

// PUT /api/expenses/:id
router.put('/:id', (req, res) => {
  const { date, description, category, amount, notes, member } = req.body
  if (!date || !description || !category || amount == null)
    return res.status(400).json({ success: false, error: 'date, description, category, amount required' })
  // Reject future dates
  const today = new Date().toISOString().slice(0, 10)
  if (date > today) return res.status(400).json({ success: false, error: 'Cannot enter future dates' })
  const month_key = date.slice(0, 7)
  db.prepare(
    "UPDATE expenses SET date=?, description=?, category=?, amount=?, notes=?, month_key=?, member=?, updated_at=datetime('now') WHERE id=?"
  ).run(date, description, category, amount, notes || null, month_key, member || null, req.params.id)
  res.json({ success: true })
})

// DELETE /api/expenses/:id
// Hard delete is allowed only for records within the last 3 calendar months.
router.delete('/:id', (req, res) => {
  const record = db.prepare('SELECT month_key FROM expenses WHERE id=?').get(req.params.id)
  if (!record) return res.status(404).json({ success: false, error: 'Record not found' })

  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const cutoffKey = cutoff.toISOString().slice(0, 7)

  if (record.month_key < cutoffKey) {
    return res.status(403).json({
      success: false,
      error: 'This record is from ' + record.month_key + ' and cannot be deleted. Only records from ' + cutoffKey + ' onwards can be removed.'
    })
  }

  db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id)
  res.json({ success: true })
})

module.exports = router
