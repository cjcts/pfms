// @ts-check
const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,

  // REQUIRED: better-sqlite3 is a module-level singleton in the backend process.
  // Running multiple workers would open the same test.db from separate processes.
  workers: 1,

  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },

  globalSetup: './tests/global-setup.js',

  webServer: [
    {
      // Backend: start-test.js sets DB_PATH=test.db and PORT=3099
      command: 'node backend/start-test.js',
      url: 'http://localhost:3099/api/health',
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      // Frontend: vite.test.config.js proxies /api → 3099, runs on 5174
      command: 'cmd /c "cd frontend && npx vite --config vite.test.config.js"',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 40_000,
    },
  ],
})
