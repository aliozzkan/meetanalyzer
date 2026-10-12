import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Testler Electron'un Node'unda koşar (bkz. package.json "test"): native modüller
// (better-sqlite3) Electron ABI'sine göre derlenir ve düz node ile yüklenemez.
export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    // Renderer testleri yalnızca saf TS içindir (DOM yok); bileşenler elle doğrulanır.
    include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts', 'src/renderer/src/**/*.test.ts'],
    environment: 'node'
  }
})
