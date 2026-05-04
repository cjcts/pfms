'use strict'
const Database = require('better-sqlite3')
const path     = require('path')

const TEST_DB_PATH = path.resolve(__dirname, '../../test.db')

// Tables in safe truncation order (no FK cycles here, but keep children first as a habit)
const TABLES = [
  'budget_targets',
  'credit_card_payments',
  'credit_card_purchases',
  'home_expenses',
  'owed_owing',
  'predictable_expenses',
  'income',
  'expenses',
]

/**
 * Truncates every table in the test database.
 * Opens a short-lived connection — safe to call from beforeAll/beforeEach
 * because Playwright uses workers:1 so there is no concurrent backend write.
 */
function resetTestDb() {
  const db = new Database(TEST_DB_PATH)
  db.pragma('foreign_keys = OFF')
  for (const table of TABLES) {
    db.prepare(`DELETE FROM ${table}`).run()
  }
  db.pragma('foreign_keys = ON')
  db.close()
}

/**
 * Insert a single row directly into any table.
 * Useful for seeding records the HTTP API cannot create
 * (e.g. old owed_owing entries with a manipulated date_added).
 */
function insertRow(table, fields) {
  const db   = new Database(TEST_DB_PATH)
  const cols = Object.keys(fields).join(', ')
  const vals = Object.keys(fields).map(() => '?').join(', ')
  const id   = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${vals})`).run(Object.values(fields)).lastInsertRowid
  db.close()
  return id
}

module.exports = { resetTestDb, insertRow }
