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
npm test              # all tests (API + UI)
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

> **Note:** E2E tests have not been updated to cover the latest UI overhaul (inline editing, copy-from-prev panels, Admin page, Reminders widget, day-only date inputs). They will need updating before they are fully passing again.

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
│   │   ├── database.js    ← better-sqlite3 singleton; auto-applies schema + idempotent column migrations on require
│   │   ├── schema.sql     ← full schema with IF NOT EXISTS guards
│   │   └── migrations/    ← manual numbered migration files for schema changes
│   └── routes/            ← one file per domain, mounted in server.js
├── frontend/
│   └── src/
│       ├── pages/         ← one file per screen, matched to a route in App.jsx
│       ├── api/           ← all fetch() calls; each page has a matching api module
│       ├── components/    ← shared UI: Layout.jsx (sidebar), ConfirmModal.jsx, EmptyState.jsx
│       └── utils/
│           ├── formatters.js      ← formatCAD, formatDate, formatMonthLabel, currentMonthKey, parseDay
│           ├── useSelectedMonth.js ← custom hook; persists selected month in localStorage
│           └── categories.js      ← EXPENSE_CATEGORIES, CATEGORY_COLORS
└── docs/
```

---

## Backend

### Adding a new route

1. Create `backend/routes/<name>.js`
2. Mount it in `backend/server.js` with `app.use('/api/<name>', require('./routes/<name>'))` — **the file alone is not enough**

### Database singleton

`database.js` opens (or creates) `finance.db`, sets `journal_mode = WAL` + `foreign_keys = ON`, runs `schema.sql` (with `IF NOT EXISTS` guards), and then applies a list of idempotent `ALTER TABLE … ADD COLUMN` statements inside a try/catch loop — safe to run on every restart. Post-install schema changes go in that list; one-off manual migrations go under `migrations/`.

### Routes currently registered

| File | Mounted at | Endpoints |
|------|-----------|-----------|
| `routes/expenses.js` | `/api/expenses` | GET `/descriptions`, GET `/`, POST `/`, PUT `/:id`, DELETE `/:id` |
| `routes/income.js` | `/api/income` | GET `/` (auto-seeds OB), POST `/`, PUT `/:id`, DELETE `/:id`, POST `/copy-from-prev` |
| `routes/summary.js` | `/api/summary` | GET `/`, GET `/history` |
| `routes/predictable.js` | `/api/predictable` | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id`, POST `/copy-from-prev` |
| `routes/creditCard.js` | `/api/credit-card` | GET `/`, GET `/descriptions`, POST `/purchases`, PUT `/purchases/:id`, DELETE `/purchases/:id`, POST `/payments`, PUT `/payments/:id`, DELETE `/payments/:id` |
| `routes/owedOwing.js` | `/api/owed-owing` | GET `/`, POST `/`, PUT `/:id`, PUT `/:id/settle`, DELETE `/:id` |
| `routes/homeExpenses.js` | `/api/home-expenses` | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id`, POST `/copy-from-prev` |
| `routes/budget.js` | `/api/budget` | GET `/`, PUT `/` (upsert by month+category) |
| `routes/admin.js` | `/api/admin` | CRUD `/categories/:type`, GET/PUT `/settings`, GET/DELETE `/clean-data` |
| `routes/reminders.js` | `/api/reminders` | GET `/`, POST `/`, PUT `/:id`, DELETE `/:id` |

**Important:** Routes that have both `POST /copy-from-prev` and `POST /` (income, predictable, homeExpenses) must register `/copy-from-prev` **before** `/:id` so Express doesn't match the literal string as an id.

### Income auto-seeding

`GET /api/income?month=YYYY-MM` checks whether any rows exist for that month. If not, it inserts a single **Opening Balance** row whose value = prior month's closing balance (prior OB + income − expenses − fixed − CC). No other sources are auto-seeded — the user adds them manually.

### Delete policy (must be in every DELETE route)

Records in the **current month + 2 prior months** may be hard-deleted. Older records return HTTP 403. Cutoff calculation:

```js
const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 7)
// reject if record.month_key < cutoff
```

The frontend mirrors this: delete button is visually disabled with tooltip "Cannot delete records older than 3 months" for out-of-window records. Hard deletes only — no `deleted_at` soft-delete pattern.

### Response envelope

All routes return `{ success: true, data: … }` or `{ success: false, error: "…" }`. Never return bare arrays or bare objects at the top level.

### Column selection

Never `SELECT *` in queries that return data to the client. Name columns explicitly.

### Admin category management

`routes/admin.js` seeds four lookup tables on startup (INSERT OR IGNORE): `expense_categories`, `income_categories`, `fixed_expense_categories`, `home_recipients`. It also runs a deprecation cleanup block that removes (or soft-deactivates if in use) categories that have been retired.

Type → table mapping used by `/api/admin/categories/:type`:
- `expense` → `expense_categories`
- `income` → `income_categories`
- `fixed` → `fixed_expense_categories`
- `recipient` → `home_recipients`
- `member` → `household_members`

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
| `/history` | `pages/History.jsx` (labelled "Trends" in nav) |
| `/budget` | `pages/BudgetPlanner.jsx` |
| `/predictable` | `pages/PredictableExpenses.jsx` |
| `/admin` | `pages/Admin.jsx` |

### API module pattern

Each page in `src/pages/` has a matching module in `src/api/` that owns all `fetch` calls for that domain. Pages never call `fetch` directly. `fetchJson` (in `src/api/fetchJson.js`) handles JSON parsing, non-JSON error detection (e.g. backend down), and throws `Error(json.error)` on `success: false` so callers can `.catch(err => …)`.

### Month selection pattern

All pages with a month picker use the `useSelectedMonth()` hook from `src/utils/useSelectedMonth.js`. This is a drop-in replacement for `useState(currentMonthKey())` that additionally persists the value in `localStorage` under the key `pfms_selected_month`. Navigating between pages preserves the selected month. **Never use `useState(currentMonthKey())` directly in a page** — use this hook instead.

### Date input pattern

Date fields use `<input type="number" min="1" max="31" placeholder="Day (1-31)">` — the user enters the day number only. `parseDay(dayStr, monthKey)` in `formatters.js` converts `"14"` + `"2026-04"` → `"2026-04-14"`, validating that the date is real (rejects e.g. April 31). Display of stored ISO dates uses `formatDate()`.

> The old DD/MM/YYYY text-input pattern is no longer used anywhere. `parseDateText` / `isoToDDMMYYYY` only exist in ExpenseEntry legacy code and should be considered deprecated.

### Form validation pattern

All forms use `noValidate` on `<form>` — no HTML5 built-in validation. Amount uses `/^\d+(\.\d{1,2})?$/`. Errors live in a `{ fieldName: 'message' }` state object, rendered inline below the failing field with `border-red-400 bg-red-50` on the input. Errors clear per-field on `onChange` and re-validate on submit.

### Confirm modal pattern

`<ConfirmModal>` in `src/components/ConfirmModal.jsx` replaces all `window.confirm()` calls. Props: `{ isOpen, title, message, confirmLabel='Delete', onConfirm, onCancel }`. Renders a centered overlay with a Cancel (outline) and Confirm (`bg-red-600`) button.

### Autocomplete pattern

Two pages use description autocomplete:
- **ExpenseEntry**: `GET /api/expenses/descriptions` — unique descriptions ordered by frequency
- **CreditCard**: `GET /api/credit-card/descriptions` — unique CC purchase descriptions ordered by frequency

Both: fetch on mount, filter client-side as the user types, render an absolutely-positioned `<ul>`. Keyboard: ↑/↓ navigate, Enter selects, Escape closes, `mousedown` outside dismisses.

### Copy-from-previous-month pattern

Income, Fixed Expenses, and Home Expenses have a collapsible "Import from [prev month]" panel:
- Opens a searchable checklist of prior-month rows
- Select all / deselect by default (all pre-selected)
- POST `/copy-from-prev` with `{ month, ids: number[] }` to import only the selected rows
- Refreshes the table on success

Credit Card has a "Pull from [prev month]" panel that populates the add form one entry at a time via copy-to-form.

### Copy-to-form pattern

Expense, Credit Card, and Home Expenses rows have a copy icon. Clicking it populates the add/edit form from that row and scrolls the form into view via `formRef.current?.scrollIntoView(…)`.

### Inline cell editing pattern

Income, Fixed Expenses, and Home Expenses support click-to-edit on individual cells (date, amount, notes, source/category):
- Clicking a cell shows a focused `<input>` or `<select>`
- Enter / blur commits; Escape cancels
- A "Save" button appears when any cell in a row is dirty (Home Expenses uses a per-row `dirty` flag)

### Design tokens

Primary `teal-600/700` · Danger `red-500` · Success `green-600` · Warning `amber-500`  
Background `gray-50` · Cards `white shadow-sm border border-gray-100`  
Text primary `gray-900` · Text secondary `gray-500`

---

## Database schema

```sql
-- Core tables (abbreviated; see schema.sql for full CREATE statements)
expenses              (id, date, description, category, amount, expense_type DEFAULT 'daily', notes, month_key, member, created_at, updated_at)
predictable_expenses  (id, month_key, category, actual, notes, date, updated_at)
income                (id, month_key, source, actual, notes, date)
credit_card_purchases (id, date, description, category, amount, my_share, notes, month_key, member)
credit_card_payments  (id, date, amount, notes, month_key)
owed_owing            (id, direction, person, reason, amount, is_settled, date_added, date_given, settled_date, notes)
home_expenses         (id, date, recipient, amount_cad, amount_inr, notes, month_key)
budget_targets        (id, month_key, category, target, UNIQUE(month_key, category))

-- Admin-managed lookup tables
expense_categories        (id, name UNIQUE, sort_order, is_active)
income_categories         (id, name UNIQUE, sort_order, is_active)
fixed_expense_categories  (id, name UNIQUE, sort_order, is_active)
home_recipients           (id, name UNIQUE, sort_order, is_active)
household_members         (id, name UNIQUE, sort_order, is_active)

-- App-wide settings
app_settings  (key PRIMARY KEY, value)

-- Reminders
reminders  (id, title, due_date, type DEFAULT 'custom', notes, is_active, created_at)
```

**Columns added via idempotent startup migrations** (in `database.js`, not schema.sql):
- `income.date`, `predictable_expenses.date`, `owed_owing.date_given`
- `expenses.member`, `credit_card_purchases.member`
- `expenses.updated_at`, `predictable_expenses.updated_at`

---

## Category taxonomy

Categories are managed via the Admin page (`/admin`) and stored in DB lookup tables. `EXPENSE_CATEGORIES` in `src/utils/categories.js` is used as the default list for the **Credit Card** category dropdown (since CC purchases cross both expense and fixed categories). Do not add category strings in ad-hoc places — update the Admin page or the DB seed in `routes/admin.js` instead.

```
Daily/variable expense categories:
  Hypermarket, Restaurants, Fuel, Transport expenses, Hospital & medicines,
  Purchases, Entertainment, Joy Activities, Gifts, Trip expenses,
  Subscriptions, Other Debits, Interest rates, Avoidable expenses, Miscellaneous

Fixed/predictable expense categories:
  House Rental, Insurances, Home Expenses (India), Offerings, Tithe,
  Investments, Savings, Car loan / EMI, Car wash & service,
  Transfers, Mobile bill payment, Miscellaneous

Home expense categories (home_recipients table):
  Transfers, Missionary  (and any user-added entries via Admin)

Income sources (income_categories table):
  Salary, CTS, CRA, Bank Interest, Marketplace, Refunds, Other Income
  (Opening Balance is auto-seeded per month; not in income_categories)
```

---

## Invariants to preserve

- **Month isolation** — every query touching time-series data must filter by `month_key`. Never return all rows without a filter.
- **Notes** — never drop or truncate `notes` fields. The user stores important context there.
- **Opening balance** — each month's opening balance = prior month's closing balance. The income table carries an `Opening Balance` row seeded when a new month is first accessed. This row cannot be deleted.
- **No localStorage for financial data** — SQLite is the source of truth for all money data. `localStorage` is used only for UI state (currently: `pfms_selected_month`).
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
| `tests/fixtures/db-reset.js` | Truncates all tables via direct `better-sqlite3` connection (bypasses HTTP) |
| `tests/fixtures/seed.js` | Inserts representative rows via API for UI tests that need pre-existing data |

Test servers run on separate ports from dev servers (backend 3099 vs 3001, frontend 5174 vs 5173) so tests never touch `finance.db`.

### Test layout

```
tests/
  fixtures/
    db-reset.js     ← resetTestDb() — call with await in every beforeAll
    seed.js         ← seedExpenses(), seedCCPurchase(), monthKey()
  global-setup.js
  api/              ← spec files, one per domain (request context only, no browser)
  ui/               ← spec files, one per page (Chromium, uses page fixture)
```

### Critical patterns

**Always `await` resetTestDb()** — it returns a Promise:
```js
// Correct
test.beforeAll(async () => { await resetTestDb() })
```

**`.first()` goes on the locator, not on `expect()`** — many strings appear in both the sidebar nav and the page heading:
```js
await expect(page.getByText('Dashboard').first()).toBeVisible()
```

**Use dynamic month keys in API tests** — hardcoded dates fall outside the 3-month delete window. Always derive from `new Date()`.

**SQLite string literals use single quotes** — `datetime("now")` silently fails. Use `datetime('now')`.

**BudgetPlanner category list** — categories with `target=0 AND actual=0` render in a collapsed "Untracked Categories" accordion (closed by default). Tests must click the toggle button first:
```js
await page.getByRole('button', { name: /Untracked Categories/i }).click()
```

**OwedOwing form** — the add form is hidden by default. Click "Add Entry" before filling fields. Direction is a pair of `type="button"` toggle buttons (not a `<select>`).
