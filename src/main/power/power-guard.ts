// Uykuyu engelleyen sebepler. Her sebep kendi blocker'ını tutar; biri bitince diğerinin
// engeli açık kalır (ör. kayıt bitti ama transcription sürüyor).
export type PowerReason = 'recording' | 'transcription'

// Electron'un `powerSaveBlocker` API'sinin kullandığımız kısmı; testlerde sahtesi geçilir.
export interface PowerSaveBlockerApi {
  start: (type: 'prevent-app-suspension') => number
  stop: (id: number) => void
}

export interface PowerGuard {
  acquire: (reason: PowerReason) => void
  release: (reason: PowerReason) => void
}

export function createPowerGuard(blocker: PowerSaveBlockerApi): PowerGuard {
  const held = new Map<PowerReason, number>()

  function acquire(reason: PowerReason): void {
    if (held.has(reason)) return
    held.set(reason, blocker.start('prevent-app-suspension'))
  }

  function release(reason: PowerReason): void {
    const id = held.get(reason)
    if (id === undefined) return
    held.delete(reason)
    blocker.stop(id)
  }

  return { acquire, release }
}
