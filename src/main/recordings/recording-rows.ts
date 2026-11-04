import type { AudioChannel } from '../../shared/audio'
import type { Db } from '../db/database'

// Bir Recording'i bitmiş olarak işaretler: bitiş zamanı ve ses süresi tek işlemde yazılır.
// Hem normal durdurma (recording-service) hem çökme sonrası onarım (recovery) kullanır.
// `durations`: tek sayı tüm kanallara yazılır; kanal adıyla verilirse her kanal kendi süresini alır.
export function markRecordingEnded(
  db: Db,
  recordingId: string,
  endedAt: number,
  durations: number | Partial<Record<AudioChannel, number>>
): void {
  db.transaction(() => {
    db.prepare('UPDATE recordings SET ended_at = ? WHERE id = ?').run(endedAt, recordingId)
    if (typeof durations === 'number') {
      db.prepare('UPDATE recording_channels SET duration_ms = ? WHERE recording_id = ?').run(
        durations,
        recordingId
      )
      return
    }
    const update = db.prepare(
      'UPDATE recording_channels SET duration_ms = ? WHERE recording_id = ? AND kind = ?'
    )
    for (const [kind, durationMs] of Object.entries(durations)) {
      update.run(durationMs, recordingId, kind)
    }
  })()
}
