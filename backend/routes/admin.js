'use strict'
const express = require('express')
const router  = express.Router()
const db      = require('../db/database')

// Seed initial data from the hardcoded lists that used to live in each route file.
// INSERT OR IGNORE means this is safe to run on every startup.
const seedData = db.transaction(() => {
  const expCats = [
    'Hypermarket','Restaurants','Fuel','Transport expenses','Hospital & medicines',
    'Purchases','Entertainment','Joy Activities','Gifts','Trip expenses',
    'Subscriptions','Other Debits','Interest rates','Avoidable expenses','Miscellaneous',
  ]
  const incCats = ['Salary','CTS','CRA','Bank Interest','Marketplace','Refunds','Other Income']
  const fixedCats = [
    'House Rental','Car loan / EMI','Insurances','Investments','Savings',
    'Home Expenses (India)','Mobile bill payment',
    'Car wash & service','Transfers','Offerings','Tithe','Miscellaneous',
  ]
  const recipients = ['Transfers','Missionary']

  expCats.forEach((name, i)   => db.prepare('INSERT OR IGNORE INTO expense_categories (name, sort_order) VALUES (?, ?)').run(name, i + 1))
  incCats.forEach((name, i)   => db.prepare('INSERT OR IGNORE INTO income_categories (name, sort_order) VALUES (?, ?)').run(name, i + 1))
  fixedCats.forEach((name, i) => db.prepare('INSERT OR IGNORE INTO fixed_expense_categories (name, sort_order) VALUES (?, ?)').run(name, i + 1))
  recipients.forEach((name, i)=> db.prepare('INSERT OR IGNORE INTO home_recipients (name, sort_order) VALUES (?, ?)').run(name, i + 1))

  // Default settings
  db.prepare("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('records_per_page', '3')").run()
})
try { seedData() } catch (err) { console.error('[admin] seedData failed (non-fatal):', err.message) }

// Remove deprecated categories — hard-delete if not in use, soft-delete if in use
;(() => {
  try {
    const deprecatedExp = ['Haircut', 'Rec Activities']
    for (const name of deprecatedExp) {
      const inUse = db.prepare('SELECT COUNT(*) as c FROM expenses WHERE category=?').get(name).c > 0
      if (inUse) {
        db.prepare('UPDATE expense_categories SET is_active=0 WHERE name=?').run(name)
      } else {
        db.prepare('DELETE FROM expense_categories WHERE name=?').run(name)
      }
    }
    const deprecatedFixed = ['EB bill payment']
    for (const name of deprecatedFixed) {
      const inUse = db.prepare('SELECT COUNT(*) as c FROM predictable_expenses WHERE category=?').get(name).c > 0
      if (inUse) {
        db.prepare('UPDATE fixed_expense_categories SET is_active=0 WHERE name=?').run(name)
      } else {
        db.prepare('DELETE FROM fixed_expense_categories WHERE name=?').run(name)
      }
    }
  } catch (err) { console.error('[admin] deprecation cleanup failed (non-fatal):', err.message) }
})()

const TABLE_MAP = {
  expense:   'expense_categories',
  income:    'income_categories',
  fixed:     'fixed_expense_categories',
  recipient: 'home_recipients',
  member:    'household_members',
}

function getTable(type) {
  const t = TABLE_MAP[type]
  if (!t) throw new Error(`Unknown type: ${type}. Use expense, income, fixed, recipient, or member.`)
  return t
}

// Check whether a name is referenced in any real data rows.
// Returns true if at least one data row uses it (→ soft delete only).
function isInUse(type, name) {
  try {
    if (type === 'expense') {
      return db.prepare('SELECT COUNT(*) as c FROM expenses WHERE category = ?').get(name).c > 0
    }
    if (type === 'income') {
      return db.prepare('SELECT COUNT(*) as c FROM income WHERE source = ?').get(name).c > 0
    }
    if (type === 'fixed') {
      return db.prepare('SELECT COUNT(*) as c FROM predictable_expenses WHERE category = ?').get(name).c > 0
    }
    if (type === 'recipient') {
      return db.prepare('SELECT COUNT(*) as c FROM home_expenses WHERE recipient = ?').get(name).c > 0
    }
    if (type === 'member') {
      const inExp = db.prepare('SELECT COUNT(*) as c FROM expenses WHERE member = ?').get(name).c
      const inCC  = db.prepare('SELECT COUNT(*) as c FROM credit_card_purchases WHERE member = ?').get(name).c
      return inExp > 0 || inCC > 0
    }
  } catch (_) {}
  return false
}

// GET /api/admin/categories/:type
router.get('/categories/:type', (req, res) => {
  try {
    const table = getTable(req.params.type)
    const rows = db.prepare(`SELECT id, name, sort_order, is_active FROM ${table} ORDER BY sort_order ASC, name ASC`).all()
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// POST /api/admin/categories/:type
router.post('/categories/:type', (req, res) => {
  try {
    const table = getTable(req.params.type)
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'name required' })
    const maxOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) as m FROM ${table}`).get().m
    const result = db.prepare(`INSERT INTO ${table} (name, sort_order, is_active) VALUES (?, ?, 1)`).run(name.trim(), maxOrder + 1)
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid } })
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ success: false, error: 'Name already exists' })
    res.status(400).json({ success: false, error: err.message })
  }
})

// PUT /api/admin/categories/:type/:id
router.put('/categories/:type/:id', (req, res) => {
  try {
    const table = getTable(req.params.type)
    const row = db.prepare(`SELECT id, name, sort_order, is_active FROM ${table} WHERE id=?`).get(req.params.id)
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    const name      = req.body.name       !== undefined ? req.body.name.trim() : row.name
    const sortOrder = req.body.sort_order !== undefined ? req.body.sort_order  : row.sort_order
    // Coerce boolean to integer — SQLite cannot bind true/false
    const isActive  = req.body.is_active  !== undefined ? (req.body.is_active ? 1 : 0) : row.is_active
    db.prepare(`UPDATE ${table} SET name=?, sort_order=?, is_active=? WHERE id=?`).run(name, sortOrder, isActive, req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// DELETE /api/admin/categories/:type/:id
// Smart delete: hard-delete if the name is not referenced in any data; soft-delete if it is.
router.delete('/categories/:type/:id', (req, res) => {
  try {
    const table = getTable(req.params.type)
    const row = db.prepare(`SELECT id, name FROM ${table} WHERE id=?`).get(req.params.id)
    if (!row) return res.status(404).json({ success: false, error: 'Not found' })
    if (isInUse(req.params.type, row.name)) {
      // Still referenced in data — soft delete so existing records still display correctly
      db.prepare(`UPDATE ${table} SET is_active=0 WHERE id=?`).run(req.params.id)
      res.json({ success: true, data: { deleted: 'soft' } })
    } else {
      // Never referenced — safe to remove entirely
      db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id)
      res.json({ success: true, data: { deleted: 'hard' } })
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message })
  }
})

// GET /api/admin/settings  — all settings as { key: value }
router.get('/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM app_settings').all()
    const settings = {}
    for (const r of rows) settings[r.key] = r.value
    res.json({ success: true, data: settings })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// PUT /api/admin/settings/:key  — update a setting
router.put('/settings/:key', (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body
    if (value === undefined) return res.status(400).json({ success: false, error: 'value required' })
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value))
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// GET /api/admin/clean-data?month=YYYY-MM  — preview record counts
router.get('/clean-data', (req, res) => {
  try {
    const { month } = req.query
    if (!month) return res.status(400).json({ success: false, error: 'month required' })
    const counts = {
      expenses:               db.prepare('SELECT COUNT(*) as c FROM expenses WHERE month_key=?').get(month).c,
      income:                 db.prepare('SELECT COUNT(*) as c FROM income WHERE month_key=?').get(month).c,
      credit_card_purchases:  db.prepare('SELECT COUNT(*) as c FROM credit_card_purchases WHERE month_key=?').get(month).c,
      credit_card_payments:   db.prepare('SELECT COUNT(*) as c FROM credit_card_payments WHERE month_key=?').get(month).c,
      home_expenses:          db.prepare('SELECT COUNT(*) as c FROM home_expenses WHERE month_key=?').get(month).c,
      predictable_expenses:   db.prepare('SELECT COUNT(*) as c FROM predictable_expenses WHERE month_key=?').get(month).c,
      budget_targets:         db.prepare('SELECT COUNT(*) as c FROM budget_targets WHERE month_key=?').get(month).c,
    }
    res.json({ success: true, data: counts })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /api/admin/clean-data?month=YYYY-MM  — hard delete all data for the month
router.delete('/clean-data', (req, res) => {
  try {
    const { month } = req.query
    if (!month) return res.status(400).json({ success: false, error: 'month required' })
    db.transaction(() => {
      db.prepare('DELETE FROM expenses WHERE month_key=?').run(month)
      db.prepare('DELETE FROM income WHERE month_key=?').run(month)
      db.prepare('DELETE FROM credit_card_purchases WHERE month_key=?').run(month)
      db.prepare('DELETE FROM credit_card_payments WHERE month_key=?').run(month)
      db.prepare('DELETE FROM home_expenses WHERE month_key=?').run(month)
      db.prepare('DELETE FROM predictable_expenses WHERE month_key=?').run(month)
      db.prepare('DELETE FROM budget_targets WHERE month_key=?').run(month)
    })()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
