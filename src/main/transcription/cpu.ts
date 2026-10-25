import { execFileSync } from 'node:child_process'
import { cpus } from 'node:os'

let cached: number | undefined

// Performans çekirdeği sayısı; whisperThreads bunun yarısını alır. Sonuç önbelleğe alınır.
// - macOS (Apple Silicon): sysctl'den performans çekirdeği sayısı. Okunamazsa (Intel, sysctl yok) tüm
//   çekirdekler performans çekirdeği sayılır.
// - Windows: bkz. windowsPerformanceCores.
export function performanceCoreCount(): number {
  if (cached !== undefined) return cached
  const logical = Math.max(1, cpus().length)
  if (process.platform === 'win32') return (cached = windowsPerformanceCores(logical))
  try {
    const out = execFileSync('sysctl', ['-n', 'hw.perflevel0.physicalcpu'], { encoding: 'utf8' })
    const count = Number.parseInt(out, 10)
    if (Number.isFinite(count) && count > 0) return (cached = count)
  } catch {
    // sysctl yok ya da anahtar tanımlı değil
  }
  return (cached = logical)
}

// docs/tuning.md → whisper thread sayısı. Windows'ta fiziksel çekirdek sayısını okumak (WMI) yavaş ve
// kırılgan; hyper-threading varsayılıp mantıksal çekirdeklerin yarısı alınır.
export function windowsPerformanceCores(logicalCores: number): number {
  return Math.max(1, Math.floor(logicalCores / 2))
}
