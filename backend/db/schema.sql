CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL,
  amount       REAL NOT NULL,
  expense_type TEXT NOT NULL DEFAULT 'daily',
  notes        TEXT,
  month_key    TEXT NOT NULL,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictable_expenses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key  TEXT NOT NULL,
  category   TEXT NOT NULL,
  budget     REAL DEFAULT 0,
  actual     REAL DEFAULT 0,
  notes      TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS income (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key  TEXT NOT NULL,
  source     TEXT NOT NULL,
  expected   REAL DEFAULT 0,
  actual     REAL DEFAULT 0,
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS credit_card_purchases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT NOT NULL,
  amount      REAL NOT NULL,
  my_share    REAL,
  notes       TEXT,
  month_key   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_card_payments (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  date      TEXT NOT NULL,
  amount    REAL NOT NULL,
  notes     TEXT,
  month_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owed_owing (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  direction    TEXT NOT NULL,
  person       TEXT NOT NULL,
  reason       TEXT,
  amount       REAL NOT NULL,
  due_date     TEXT,
  is_settled   INTEGER DEFAULT 0,
  date_added   TEXT NOT NULL,
  settled_date TEXT,
  notes        TEXT
);

CREATE TABLE IF NOT EXISTS home_expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  amount_cad  REAL NOT NULL,
  amount_inr  REAL,
  notes       TEXT,
  month_key   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_targets (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL,
  category  TEXT NOT NULL,
  target    REAL NOT NULL,
  UNIQUE(month_key, category)
);

CREATE INDEX IF NOT EXISTS idx_expenses_month    ON expenses(month_key);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_cc_month          ON credit_card_purchases(month_key);
CREATE INDEX IF NOT EXISTS idx_income_month      ON income(month_key);

-- Admin-managed lookup tables
CREATE TABLE IF NOT EXISTS expense_categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active  INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS income_categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active  INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS fixed_expense_categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active  INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS home_recipients (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active  INTEGER DEFAULT 1
);

-- Household members (for tagging expenses/purchases)
CREATE TABLE IF NOT EXISTS household_members (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  is_active  INTEGER DEFAULT 1
);

-- App-wide settings (key/value)
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Custom reminders
CREATE TABLE IF NOT EXISTS reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  due_date   TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'custom',
  notes      TEXT,
  is_active  INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
