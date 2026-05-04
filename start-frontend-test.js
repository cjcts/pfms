'use strict'
// Spawns the Vite dev server from the frontend/ directory.
// Playwright's webServer config cannot change cwd, so this wrapper handles it.
const { spawn } = require('child_process')
const path = require('path')

const child = spawn(
  'npx',
  ['vite', '--config', 'vite.test.config.js'],
  {
    cwd: path.join(__dirname, 'frontend'),
    stdio: 'inherit',
    shell: true,   // required on Windows for npx resolution
  }
)

child.on('exit', code => process.exit(code ?? 0))
process.on('SIGTERM', () => { try { child.kill('SIGTERM') } catch (_) {} })
process.on('SIGINT',  () => { try { child.kill('SIGINT')  } catch (_) {} })
