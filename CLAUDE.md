# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Autonomy constraints

**Do not run the app** unless the user explicitly asks. Both servers have hot-reload (`nodemon` on the backend, Vite HMR on the frontend) — code changes take effect automatically. Starting, restarting, or stopping servers without being asked is disruptive.

**Do not run tests** unless the user explicitly asks. The user tests the app manually.

---

## What this project is

A fully local, single-user personal finance web application. No cloud, no auth, no external services. Data lives in `backend/finance.db` (SQLite). The user tracks daily/variable expenses, fixed monthly expenses, income, credit card purchases, money owed/owing, and large home/India remittance transfers — updated every few days in batches, not daily.

---

## Dev commands

```bash
# Backend — nodemon watches for changes (port 3001)
cd backend && npm run dev

# Backend — plain node, no watch
cd backend && npm start

# Frontend — Vite dev server (port 5173), proxies /api → localhost:3001
cd frontend && npm run dev

# Frontend — production build
cd frontend && npm run build
```

No linter is configured.

### E2E tests (Playwright)

Run from the `pfms/` root (where `playwright.config.js` lives):

```bash
npm test              # all 122 tests (API + UI)
npm run test:api      # API tests only — no browser, fast
npm run test:ui       # UI tests only — headless Chromium
npm run test:headed   # UI tests in a visible browser window (debug)
npm run report        # open the last HTML report in a browser
```

First-time setup (only needed once):

```bash
npm install
npx playwright install chromium
```

---

## Tech stack

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | React 18 + Vite         |
| Styling  | Tailwind CSS (utility only, no custom CSS files) |
| Charts   | Recharts                |
| Icons    | Lucide React            |
| Backend  | Node.js + Express       |
| Database | SQLite via better-sqlite3 |

---

## Project architecture

```
pfms/
├── backend/
│   ├── server.js          ← Express entry point; mounts all route files
│   ├── db/
│   │   ├── database.js    ← better-sqlite3 singleton; auto-applies schema on require
│   │   ├── schema.sql     ← full schema with IF NOT EXISTS guards
│   │   └── migrations/    ← manual numbered migration files for schema changes
│   └── routes/            ← one file per domain, mounted in server.js
├── frontend/
│   └── src/
│       ├── pages/         ← one file per screen, matched to a route in App.jsx
│       ├── api/           ← all fetch() calls; each page has a matching api module
│       ├── components/    ← shared UI: Layout.jsx (sidebar + Outlet), etc.
│       └── utils/
│           ├── formatters.js   ← formatCAD, formatDate, formatMonthLabel, currentMonthKey
│           └── categories.js  ← EXPENSE_CATEGORIES (32 values), CATEGORY_COLORS
└── docs/
```

---

## Backend

### Adding a new route

1. Create `backend/routes/<name>.js`
2. Mount it in `backend/server.js` with `app.use('/api/<name>', require('./routes/<name>'))` — **the file alone is not enough**

### Database singleton

`database.js` opens (or creates) `finance.db`, sets `journal_mode = WAL` + `foreign_keys = ON`, and runs `schema.sql` with `IF NOT EXISTS` guards — schema self-applies on fresh installs. For post-install schema changes, add a numbered file under `migrations/` and run it once manually.

### Routes currently registered

| File | Mounted at | Built endpoints |
|------|-----------|-----------------|
| `routes/expenses.js` | `/api/expenses` | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id`, GET `/descriptions` |
| `routes/income.js` | `/api/income` | GET `/` (auto-seeds), PUT `/:id` |
| `routes/summary.js` | `/api/summary` | GET `/`, GET `/history` |
| `routes/predictable.js` | `/api/predictable` | GET `/` (auto-seeds), PUT `/:id` |
| `routes/creditCard.js` | `/api/credit-card` | GET/POST/PUT `/:id`/DELETE `/:id` purchases; GET/POST/DELETE `/:id` payments |
| `routes/owedOwing.js` | `/api/owed-owing` | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id`, PUT `/:id/settle` |
| `routes/homeExpenses.js` | `/api/home-expenses` | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id` |
| `routes/budget.js` | `/api/budget` | GET `/`, PUT `/` (upsert by month+category) |

### Income / month auto-seeding

`GET /api/income?month=YYYY-MM` inserts one row per source from `DEFAULT_SOURCES` with `expected=0, actual=0` the first time that month is accessed. Follow this pattern for any table that needs default rows per month.

### Delete policy (must be in every DELETE route)

Records in the **current month + 2 prior months** may be hard-deleted. Older records return HTTP 403. Cutoff calculation:

```js
const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)
// reject if record.month_key < cutoff
```

The frontend mirrors this: delete button is visually disabled with tooltip "Cannot delete records older than 3 months" for out-of-window records. Do not add `deleted_at` — hard deletes are the only kind allowed.

### Response envelope

All routes return `{ success: true, data: … }` or `{ success: false, error: "…" }`. Never return bare arrays or bare objects at the top level.

### Column selection

Never `SELECT *` in queries that return data to the client. Name columns explicitly.

---

## Frontend

### Pages built

All pages are fully implemented and wired in `App.jsx`:

| Route | File |
|-------|------|
| `/dashboard` | `pages/Dashboard.jsx` |
| `/expenses` | `pages/ExpenseEntry.jsx` |
| `/credit-card` | `pages/CreditCard.jsx` |
| `/income` | `pages/Income.jsx` |
| `/owed-owing` | `pages/OwedOwing.jsx` |
| `/home` | `pages/HomeExpenses.jsx` |
| `/history` | `pages/History.jsx` |
| `/budget` | `pages/BudgetPlanner.jsx` |
| `/predictable` | `pages/Predictable.jsx` |

### API module pattern

Each page in `src/pages/` has a matching module in `src/api/` that owns all `fetch` calls for that domain. Pages never call `fetch` directly. API modules throw `Error(json.error)` on `success: false` so callers can `.catch(err => ...)`.

### Date handling pattern

Date fields are plain `<input type="text">` — never `type="date"`. The user types `DD/MM/YYYY`. `parseDateText(text, monthKey)` in `ExpenseEntry.jsx` validates the format, checks the date is real, and confirms it falls within the selected month before returning `YYYY-MM-DD` for storage. Converting a stored ISO date back into the text field uses `isoToDDMMYYYY()`. Display uses `formatDate()` from `formatters.js`.

### Form validation pattern

All forms use `noValidate` on `<form>` — no HTML5 built-in validation. Amount uses `/^\d+(\.\d{1,2})?$/`. Errors live in a `{ fieldName: 'message' }` state object, rendered inline below the failing field with `border-red-400 bg-red-50` on the input. Errors clear per-field on `onChange` and re-validate on submit.

### Autocomplete pattern (descriptions)

`GET /api/expenses/descriptions` returns unique descriptions ordered by frequency. The ExpenseEntry page fetches this on mount, filters client-side as the user types, and renders an absolutely-positioned `<ul>` dropdown. Keyboard: ↑/↓ navigate, Enter selects, Escape closes, `mousedown` outside dismisses.

### Copy-to-form pattern

Each expense row has a copy icon (`Copy` from lucide-react). Clicking it populates the form state from that row (converting stored ISO date → `DD/MM/YYYY`) and scrolls the form into view via `formRef.current?.scrollIntoView(…)`.

### Batch entry

After a successful add, the form resets to `emptyForm()` but preserves `expense_type` (and optionally `date`) so the user can immediately add the next expense without any extra clicks.

### Design tokens

Primary `teal-600/700` · Danger `red-500` · Success `green-600` · Warning `amber-500`  
Background `gray-50` · Cards `white shadow-sm border border-gray-100`  
Text primary `gray-900` · Text secondary `gray-500`

---

## Database schema

```sql
CREATE TABLE expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL,        -- YYYY-MM-DD
  description  TEXT NOT NULL,
  category     TEXT NOT NULL,        -- must match EXPENSE_CATEGORIES
  amount       REAL NOT NULL,
  expense_type TEXT NOT NULL DEFAULT 'daily',  -- 'daily' | 'unpredictable'
  notes        TEXT,
  month_key    TEXT NOT NULL,        -- YYYY-MM
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE predictable_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, month_key TEXT NOT NULL,
  category TEXT NOT NULL, budget REAL DEFAULT 0, actual REAL DEFAULT 0,
  notes TEXT, updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE income (
  id INTEGER PRIMARY KEY AUTOINCREMENT, month_key TEXT NOT NULL,
  source TEXT NOT NULL, expected REAL DEFAULT 0, actual REAL DEFAULT 0, notes TEXT
);

CREATE TABLE credit_card_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
  description TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL,
  my_share REAL, notes TEXT, month_key TEXT NOT NULL
);

CREATE TABLE credit_card_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
  amount REAL NOT NULL, notes TEXT, month_key TEXT NOT NULL
);

CREATE TABLE owed_owing (
  id INTEGER PRIMARY KEY AUTOINCREMENT, direction TEXT NOT NULL,  -- 'to_give' | 'to_get'
  person TEXT NOT NULL, reason TEXT, amount REAL NOT NULL, due_date TEXT,
  is_settled INTEGER DEFAULT 0, date_added TEXT NOT NULL, settled_date TEXT, notes TEXT
);

CREATE TABLE home_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
  recipient TEXT NOT NULL, amount_cad REAL NOT NULL, amount_inr REAL,
  notes TEXT, month_key TEXT NOT NULL
);

CREATE TABLE budget_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, month_key TEXT NOT NULL,
  category TEXT NOT NULL, target REAL NOT NULL,
  UNIQUE(month_key, category)
);

-- Indexes
CREATE INDEX idx_expenses_month    ON expenses(month_key);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_cc_month          ON credit_card_purchases(month_key);
CREATE INDEX idx_income_month      ON income(month_key);
```

---

## Category taxonomy

`EXPENSE_CATEGORIES` in `src/utils/categories.js` is the **single source of truth**. Never add category strings anywhere else. Do not create new categories without updating this list and asking first.

```
Daily/variable: Hypermarket, Restaurants, Fuel, Transport expenses, Hospital & medicines,
  Purchases, Entertainment, Joy Activities, Gifts, Trip expenses, Haircut, Subscriptions,
  Other Debits, Interest rates, Rec Activities, Avoidable expenses, Miscellaneous

Predictable/fixed: House Rental, Insurances, Home Expenses (India), Offerings, Tithe,
  Investments, Savings, EB bill payment, Car loan / EMI, Car wash & service,
  Transfers, Mobile bill payment
```

Income sources (`INCOME_SOURCES`): Opening Balance, Salary, CTS, CRA, Bank Interest, Marketplace, Refunds, Other Income.

---

## Invariants to preserve

- **Month isolation** — every query touching time-series data must filter by `month_key`. Never return all rows without a filter.
- **Notes** — never drop or truncate `notes` fields. The user stores important context there.
- **Opening balance** — each month's opening balance = prior month's closing balance. The income table carries an `Opening Balance` row seeded when a new month is first accessed.
- **No localStorage for financial data** — all state goes to SQLite via the API.
- **No cloud services, no auth** — intentionally single-user and local.

---

## E2E test suite

### Infrastructure

| File | Purpose |
|------|---------|
| `playwright.config.js` | Root config — `workers: 1`, HTML+list reporters, two `webServer` entries |
| `backend/start-test.js` | Sets `DB_PATH=test.db` and `PORT=3099`, then requires `server.js` |
| `frontend/vite.test.config.js` | Vite config for tests — proxies `/api` → `localhost:3099`, runs on port 5174 |
| `tests/global-setup.js` | Deletes stale `test.db` before the first test run |
| `tests/fixtures/db-reset.js` | Truncates all 8 tables via direct `better-sqlite3` connection (bypasses HTTP) |
| `tests/fixtures/seed.js` | Inserts representative rows via API for UI tests that need pre-existing data |

Test servers run on separate ports from dev servers (backend 3099 vs 3001, frontend 5174 vs 5173) so tests never touch `finance.db`.

The `DB_PATH` env var in `backend/db/database.js` controls which SQLite file is opened:
```js
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'finance.db')
```

### Test layout

```
tests/
  fixtures/
    db-reset.js     ← resetTestDb() — call with await in every beforeAll
    seed.js         ← seedExpenses(), seedCCPurchase(), monthKey()
  global-setup.js
  api/              ← 8 spec files, one per domain (request context only, no browser)
  ui/               ← 9 spec files, one per page (Chromium, uses page fixture)
```

### Critical patterns

**Always `await` resetTestDb()** — it returns a Promise. Omitting `await` in an `async beforeAll` causes a race condition where tests start before truncation finishes:
```js
// Correct
test.beforeAll(async () => { await resetTestDb() })
// Wrong — fires and forgets
test.beforeAll(async () => { resetTestDb() })
```

**`.first()` goes on the locator, not on `expect()`** — Playwright strict mode throws if a locator matches more than one element. Many text strings appear in both the sidebar nav and the page heading:
```js
// Correct
await expect(page.getByText('Dashboard').first()).toBeVisible()
await expect(page.getByText(/Month/i).or(page.getByText(/Income/i)).first()).toBeVisible()
// Wrong — .first() does not exist on the expect wrapper
await expect(page.getByText('Dashboard')).first().toBeVisible()
```

**Use dynamic month keys in API tests** — hardcoded dates like `'2025-04'` fall outside the 3-month delete window and make DELETE tests return 403. Always derive dates from `new Date()`.

**SQLite string literals use single quotes** — `datetime("now")` silently fails (treats `"now"` as a column identifier). Use `datetime('now')`.

**BudgetPlanner category list** — categories with `target=0 AND actual=0` render in a collapsed "Untracked Categories" accordion (closed by default). Tests that assert category names must click the toggle button first:
```js
await page.getByRole('button', { name: /Untracked Categories/i }).click()
```

**OwedOwing form** — the add form is hidden by default (`showForm = false`). Click "Add Entry" before filling fields. Direction is a pair of `type="button"` toggle buttons (not a `<select>`). Submit is `button[type="submit"]`.

### What is not built yet

- Categories/Types management screen (future requirement)
- Excel data migration (see `docs/DATA_MIGRATION.md`)
