const express = require('express')
const router = express.Router()
const db = require('../db/database')

// Helper: compute deletable cutoff (current month minus 2 = oldest allowed month)
function deleteCutoff() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)
}

function getPriorMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// GET /api/credit-card?month=YYYY-MM
router.get('/', (req, res) => {
  try {
    const { month } = req.query
    if (!month) return res.status(400).json({ success: false, error: 'month param required (YYYY-MM)' })

    const purchases = db.prepare(
      'SELECT id, date, description, category, amount, notes, month_key, member FROM credit_card_purchases WHERE month_key = ? ORDER BY date DESC'
    ).all(month)

    const payments = db.prepare(
      'SELECT id, date, amount, notes, month_key FROM credit_card_payments WHERE month_key = ? ORDER BY date DESC'
    ).all(month)

    const priorMonthKey = getPriorMonthKey(month)
    const priorPurch = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM credit_card_purchases WHERE month_key=?').get(priorMonthKey).t
    const priorPay   = db.prepare('SELECT COALESCE(SUM(amount),0) as t FROM credit_card_payments WHERE month_key=?').get(priorMonthKey).t
    const priorOutstanding = Math.max(0, Math.round((priorPurch - priorPay) * 100) / 100)

    res.json({ success: true, data: { purchases, payments, priorOutstanding } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/credit-card/purchases
router.post('/purchases', (req, res) => {
  try {
    const { date, description, category, amount, notes, member } = req.body
    if (!date || !description || !category || amount == null)
      return res.status(400).json({ success: false, error: 'date, description, category, amount required' })

    const today = new Date().toISOString().slice(0, 10)
    if (date > today) return res.status(400).json({ success: false, error: 'Cannot enter future dates' })

    const month_key = date.slice(0, 7)
    const result = db.prepare(
      'INSERT INTO credit_card_purchases (date, description, category, amount, my_share, notes, month_key, member) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)'
    ).run(date, description, category, amount, notes || null, month_key, member || null)

    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PUT /api/credit-card/purchases/:id
router.put('/purchases/:id', (req, res) => {
  try {
    const { date, description, category, amount, notes, member } = req.body
    const record = db.prepare('SELECT id FROM credit_card_purchases WHERE id=?').get(req.params.id)
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' })

    const today = new Date().toISOString().slice(0, 10)
    if (date && date > today) return res.status(400).json({ success: false, error: 'Cannot enter future dates' })

    db.prepare(
      'UPDATE credit_card_purchases SET date=?, description=?, category=?, amount=?, notes=?, member=? WHERE id=?'
    ).run(date, description, category, amount, notes || null, member || null, req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/credit-card/purchases/:id
router.delete('/purchases/:id', (req, res) => {
  try {
    const record = db.prepare('SELECT month_key FROM credit_card_purchases WHERE id=?').get(req.params.id)
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' })

    const cutoff = deleteCutoff()
    if (record.month_key < cutoff) {
      return res.status(403).json({
        success: false,
        error: `This record is from ${record.month_key} and cannot be deleted. Only the last 3 months of data can be removed.`
      })
    }

    db.prepare('DELETE FROM credit_card_purchases WHERE id=?').run(req.params.id)
    res.json({ success: true, data: null })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/credit-card/payments
router.post('/payments', (req, res) => {
  try {
    const { date, amount, notes } = req.body
    if (!date || amount == null)
      return res.status(400).json({ success: false, error: 'date and amount required' })

    const month_key = date.slice(0, 7)
    const result = db.prepare(
      'INSERT INTO credit_card_payments (date, amount, notes, month_key) VALUES (?, ?, ?, ?)'
    ).run(date, amount, notes || null, month_key)

    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PUT /api/credit-card/payments/:id
router.put('/payments/:id', (req, res) => {
  try {
    const { date, amount, notes } = req.body
    const record = db.prepare('SELECT id FROM credit_card_payments WHERE id=?').get(req.params.id)
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' })
    db.prepare(
      'UPDATE credit_card_payments SET date=?, amount=?, notes=? WHERE id=?'
    ).run(date, amount, notes || null, req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/credit-card/payments/:id
router.delete('/payments/:id', (req, res) => {
  try {
    const record = db.prepare('SELECT month_key FROM credit_card_payments WHERE id=?').get(req.params.id)
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' })

    const cutoff = deleteCutoff()
    if (record.month_key < cutoff) {
      return res.status(403).json({
        success: false,
        error: `This record is from ${record.month_key} and cannot be deleted. Only the last 3 months of data can be removed.`
      })
    }

    db.prepare('DELETE FROM credit_card_payments WHERE id=?').run(req.params.id)
    res.json({ success: true, data: null })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
