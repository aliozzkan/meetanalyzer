import { defineConfig } from 'vitest/config'

// Testler Electron'un Node'unda koşar (bkz. package.json "test"): native modüller
// (better-sqlite3) Electron ABI'sine göre derlenir ve düz node ile yüklenemez.
export default defineConfig({
  test: {
    include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
    environment: 'node'
  }
})
