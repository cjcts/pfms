const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.DB_PATH
  ? require('path').resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'finance.db')
const SCHEMA_PATH = path.join(__dirname, 'schema.sql')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
db.exec(schema)

// Idempotent column additions — SQLite errors if column already exists; try/catch makes it safe
const colMigrations = [
  "ALTER TABLE income ADD COLUMN date TEXT",
  "ALTER TABLE predictable_expenses ADD COLUMN date TEXT",
  "ALTER TABLE owed_owing ADD COLUMN date_given TEXT",
  "ALTER TABLE expenses ADD COLUMN updated_at TEXT",
  "ALTER TABLE predictable_expenses ADD COLUMN updated_at TEXT",
  "ALTER TABLE expenses ADD COLUMN member TEXT",
  "ALTER TABLE credit_card_purchases ADD COLUMN member TEXT",
]
for (const m of colMigrations) { try { db.exec(m) } catch (_) {} }

module.exports = db
