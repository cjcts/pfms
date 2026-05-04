'use strict'
// Sets DB_PATH to the sibling test.db before loading server.js.
// Used by Playwright's webServer config so tests never touch finance.db.
process.env.DB_PATH = require('path').join(__dirname, '..', 'test.db')
process.env.PORT = '3099'
require('./server')
