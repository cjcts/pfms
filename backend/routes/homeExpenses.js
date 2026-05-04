const express = require('express')
const router = express.Router()
const db = require('../db/database')

// GET /?month=YYYY-MM
router.get('/', (req, res) => {
  const { month } = req.query
  if (!month) {
    return res.status(400).json({ success: false, error: 'month query parameter is required (YYYY-MM)' })
  }
  try {
    const rows = db.prepare(`
      SELECT id, date, recipient, amount_cad, amount_inr, notes, month_key
      FROM home_expenses
      WHERE month_key = ?
      ORDER BY date ASC, id ASC
    `).all(month)
    const recipients = db.prepare('SELECT name FROM home_recipients WHERE is_active=1 ORDER BY sort_order ASC, name ASC').all().map(r => r.name)
    return res.json({ success: true, data: { rows, recipients } })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

// POST /copy-from-prev — must be before /:id routes
// Body: { month, ids?: number[] }  — ids restricts which prior-month rows to copy
router.post('/copy-from-prev', (req, res) => {
  try {
    const { month, ids } = req.body
    if (!month) return res.status(400).json({ success: false, error: 'month required' })
    const [y, m] = month.split('-').map(Number)
    const pd = new Date(y, m - 2, 1)
    const prior = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}`
    let rows
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const ph = ids.map(() => '?').join(', ')
      rows = db.prepare(`SELECT recipient, amount_cad, notes FROM home_expenses WHERE month_key=? AND id IN (${ph})`).all(prior, ...ids)
    } else {
      rows = db.prepare('SELECT recipient, amount_cad, notes FROM home_expenses WHERE month_key=?').all(prior)
    }
    const today = new Date().toISOString().slice(0, 10)
    const insert = db.prepare('INSERT INTO home_expenses (date, recipient, amount_cad, notes, month_key) VALUES (?, ?, ?, ?, ?)')
    db.transaction(() => { for (const r of rows) insert.run(today, r.recipient, r.amount_cad, r.notes, month) })()
    res.json({ success: true, data: { count: rows.length } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /
router.post('/', (req, res) => {
  const { date, recipient, amount_cad, amount_inr, notes } = req.body

  if (!date || !recipient || amount_cad == null) {
    return res.status(400).json({ success: false, error: 'date, recipient, and amount_cad are required' })
  }
  if (typeof amount_cad !== 'number' || amount_cad <= 0) {
    return res.status(400).json({ success: false, error: 'amount_cad must be a positive number' })
  }

  const month_key = String(date).slice(0, 7)

  try {
    const result = db.prepare(
      'INSERT INTO home_expenses (date, recipient, amount_cad, amount_inr, notes, month_key) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(date, recipient, amount_cad, amount_inr ?? null, notes ?? null, month_key)

    return res.status(201).json({ success: true, data: { id: result.lastInsertRowid } })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /:id
router.delete('/:id', (req, res) => {
  const { id } = req.params

  try {
    const record = db.prepare(`
      SELECT id, month_key FROM home_expenses WHERE id = ?
    `).get(id)

    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' })
    }

    const now = new Date()
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)

    if (record.month_key < cutoff) {
      return res.status(403).json({
        success: false,
        error: `This record is from ${record.month_key} and cannot be deleted. Only the last 3 months of data can be removed.`
      })
    }

    db.prepare('DELETE FROM home_expenses WHERE id = ?').run(id)
    return res.json({ success: true, data: { id: Number(id) } })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
