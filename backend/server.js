const express = require('express')
const cors = require('cors')
const app = express()

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/expenses',      require('./routes/expenses'))
app.use('/api/income',        require('./routes/income'))
app.use('/api/summary',       require('./routes/summary'))
app.use('/api/credit-card',   require('./routes/creditCard'))
app.use('/api/home-expenses', require('./routes/homeExpenses'))
app.use('/api/owed-owing',    require('./routes/owedOwing'))
app.use('/api/predictable',   require('./routes/predictable'))
app.use('/api/budget',        require('./routes/budget'))
app.use('/api/admin',         require('./routes/admin'))
app.use('/api/reminders',     require('./routes/reminders'))

app.get('/api/health', (req, res) => res.json({ ok: true }))

// 404 handler — returns JSON instead of Express default HTML "Cannot GET /..."
app.use((req, res, _next) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` })
})

// Global JSON error handler — prevents Express from returning HTML on unhandled errors
app.use((err, req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ success: false, error: err.message || 'Internal server error' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log('PFMS backend running on http://localhost:' + PORT))
