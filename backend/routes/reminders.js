'use strict'
const express = require('express')
const router  = express.Router()
const db      = require('../db/database')

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7)
}
function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// GET /api/reminders — combined alert list
router.get('/', (req, res) => {
  try {
    const today      = new Date().toISOString().slice(0, 10)
    const in3Days    = addDays(today, 3)
    const curMonth   = currentMonthKey()
    const alerts = []

    // 1. Custom reminders due within 3 days
    const custom = db.prepare("SELECT id, title, due_date, notes FROM reminders WHERE is_active=1 AND due_date <= ?").all(in3Days)
    for (const r of custom) {
      alerts.push({ id: r.id, type: 'custom', title: r.title, detail: r.notes || '', due_date: r.due_date, ref_id: r.id })
    }

    // 2. Unsettled owed/owing entries
    const owed = db.prepare('SELECT id, direction, person, amount FROM owed_owing WHERE is_settled=0').all()
    for (const r of owed) {
      const label = r.direction === 'to_give' ? `You owe ${r.person}` : `${r.person} owes you`
      alerts.push({ id: `oo_${r.id}`, type: 'owed_owing', title: label, detail: `$${r.amount.toFixed(2)} CAD`, due_date: null, ref_id: r.id })
    }

    // 3. Fixed expenses with a date in the next 3 days
    const fixed = db.prepare("SELECT id, category, actual, date FROM predictable_expenses WHERE month_key=? AND date IS NOT NULL AND date BETWEEN ? AND ?").all(curMonth, today, in3Days)
    for (const r of fixed) {
      alerts.push({ id: `pe_${r.id}`, type: 'fixed_expense', title: r.category, detail: `$${r.actual.toFixed(2)} due`, due_date: r.date, ref_id: r.id })
    }

    // 4. CC payment alert: purchases but no payment this month
    const ccPurch = db.prepare('SELECT COUNT(*) as c FROM credit_card_purchases WHERE month_key=?').get(curMonth).c
    const ccPay   = db.prepare('SELECT COUNT(*) as c FROM credit_card_payments WHERE month_key=?').get(curMonth).c
    if (ccPurch > 0 && ccPay === 0) {
      alerts.push({ id: 'cc_payment', type: 'cc_payment', title: 'Credit card payment pending', detail: 'No payment recorded this month', due_date: null, ref_id: null })
    }

    res.json({ success: true, data: alerts })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// POST /api/reminders
router.post('/', (req, res) => {
  try {
    const { title, due_date, notes } = req.body
    if (!title?.trim() || !due_date) return res.status(400).json({ success: false, error: 'title and due_date required' })
    const result = db.prepare("INSERT INTO reminders (title, due_date, notes, type) VALUES (?, ?, ?, 'custom')").run(title.trim(), due_date, notes || null)
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PUT /api/reminders/:id
router.put('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT id FROM reminders WHERE id=?').get(req.params.id)
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    const { title, due_date, notes } = req.body
    db.prepare('UPDATE reminders SET title=?, due_date=?, notes=? WHERE id=?').run(title, due_date, notes || null, req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/reminders/:id  (soft delete)
router.delete('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT id FROM reminders WHERE id=?').get(req.params.id)
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    db.prepare('UPDATE reminders SET is_active=0 WHERE id=?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
