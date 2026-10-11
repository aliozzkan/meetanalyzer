import { execFileSync } from 'node:child_process'
import { cpus } from 'node:os'

let cached: number | undefined

// Apple Silicon'da performans çekirdeği sayısı. Okunamazsa (Intel, sysctl yok) tüm çekirdekler performans
// çekirdeği sayılır; whisperThreads bunun yarısını alır. Sonuç önbelleğe alınır (sysctl bir kez çalışır).
export function performanceCoreCount(): number {
  if (cached !== undefined) return cached
  try {
    const out = execFileSync('sysctl', ['-n', 'hw.perflevel0.physicalcpu'], { encoding: 'utf8' })
    const count = Number.parseInt(out, 10)
    if (Number.isFinite(count) && count > 0) return (cached = count)
  } catch {
    // sysctl yok ya da anahtar tanımlı değil
  }
  return (cached = Math.max(1, cpus().length))
}
