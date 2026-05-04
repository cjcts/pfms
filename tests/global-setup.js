'use strict'
const fs   = require('fs')
const path = require('path')

// Deletes test.db (and WAL/SHM siblings) before each test run so every run
// starts with a fresh, empty database. Ignores lock errors — those come from
// zombie processes left over by a previous crashed run; per-test resetTestDb()
// truncates tables anyway so data isolation is preserved.
module.exports = async function globalSetup() {
  const db = path.resolve(__dirname, '../test.db')
  for (const f of [db, db + '-wal', db + '-shm']) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f)
    } catch (e) {
      console.warn(`[global-setup] Could not delete ${path.basename(f)}: ${e.message} (continuing)`)
    }
  }
}
