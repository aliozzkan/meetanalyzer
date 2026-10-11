import type { Db } from '../db/database'

// Bir Recording'i bitmiş olarak işaretler: bitiş zamanı ve ses süresi tek işlemde yazılır.
// Hem normal durdurma (recording-service) hem çökme sonrası onarım (recovery) kullanır.
export function markRecordingEnded(
  db: Db,
  recordingId: string,
  endedAt: number,
  durationMs: number
): void {
  db.transaction(() => {
    db.prepare('UPDATE recordings SET ended_at = ? WHERE id = ?').run(endedAt, recordingId)
    db.prepare('UPDATE recording_channels SET duration_ms = ? WHERE recording_id = ?').run(
      durationMs,
      recordingId
    )
  })()
}
