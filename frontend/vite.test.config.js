import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Separate Vite config for the test runner.
// Runs on port 5174 and proxies /api to the test backend on port 3099.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3099'
    }
  }
})
