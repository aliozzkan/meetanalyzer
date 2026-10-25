// vitest'i Electron'un Node'uyla çalıştırır: better-sqlite3 Electron ABI'sine göre derlendiği için testler
// sistemdeki Node ile açılamaz. Ortam değişkeni burada verilir; `VAR=1 komut` söz dizimi Windows'ta çalışmaz.
// Kullanım: pnpm test [vitest argümanları]
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronPath = require('electron') // Node'dan çağrılınca Electron binary'sinin yolunu verir
const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url))

const child = spawn(electronPath, [vitest, 'run', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
child.on('error', (error) => {
  console.error(`Electron başlatılamadı: ${error.message}`)
  process.exit(1)
})
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
