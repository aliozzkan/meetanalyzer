import { closeSync, existsSync, ftruncateSync, openSync, rmSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { BLOCK_ALIGN, durationMsFromBytes } from '../../shared/audio'
import type { Db } from '../db/database'
import { resolveRecordingFile } from './recording-paths'
import { markRecordingEnded } from './recording-rows'
import { WAV_HEADER_BYTES, writeWavHeader } from './wav'

export interface RecoveryResult {
  repaired: number
  discarded: number
  /** İşlenemeyen satırlar (geçersiz yol, dosya sistemi hatası); bunlar loglanır ve atlanır. */
  failed: number
}

interface InterruptedRow {
  id: string
  started_at: number
  file_path: string
}

// Uygulama kayıt sırasında çöktüyse (kill -9, elektrik kesintisi) açılışta `ended_at`'i boş kalan
// Recording'leri toparlar. Aktif Recording yalnızca bellekte izlenir; açılışta kalan her bu tür satır
// bir çökme artığıdır. IPC kaydedilmeden önce çalıştırılmalıdır.
//   - Ses içeren dosya: yarım örnek kesilir, header gerçek boyutla yeniden yazılır, süre ve `ended_at` yazılır.
//   - Ses içermeyen (boş, header'ı yarım, dosyası hiç olmayan) dosya: Recording satırı, dosyası ve klasörüyle silinir.
// Meeting durumuna dokunulmaz. Bir satırın hatası diğerlerinin toparlanmasını engellemez.
// Her adım yeniden çalıştırmaya dayanıklıdır: dosya boyutundan yeniden hesaplanır; silmede önce dosya,
// sonra satır silinir, böylece arada çökme satırı bırakır ve sonraki açılış onu "dosya yok" diye temizler.
export function recoverInterruptedRecordings({
  db,
  recordingsDir
}: {
  db: Db
  recordingsDir: string
}): RecoveryResult {
  const rows = db
    .prepare(
      `SELECT r.id, r.started_at, c.file_path
       FROM recordings r JOIN recording_channels c ON c.recording_id = r.id
       WHERE r.ended_at IS NULL`
    )
    .all() as InterruptedRow[]

  const result: RecoveryResult = { repaired: 0, discarded: 0, failed: 0 }
  for (const row of rows) {
    try {
      const outcome = recoverRow(db, recordingsDir, row)
      result[outcome] += 1
    } catch (error) {
      console.error('Kayıt toparlanamadı:', row.id, error)
      result.failed += 1
    }
  }
  return result
}

function recoverRow(db: Db, recordingsDir: string, row: InterruptedRow): 'repaired' | 'discarded' {
  const file = resolveRecordingFile(recordingsDir, row.file_path)

  const dataBytes = audioBytesIn(file)
  if (dataBytes === 0) {
    rmSync(dirname(file), { recursive: true, force: true })
    db.prepare('DELETE FROM recordings WHERE id = ?').run(row.id)
    return 'discarded'
  }

  rewriteHeader(file, dataBytes)
  const durationMs = durationMsFromBytes(dataBytes)
  markRecordingEnded(db, row.id, row.started_at + durationMs, durationMs)
  return 'repaired'
}

// Dosyadaki tam örneklerden oluşan ses verisinin bayt sayısı; çökme bir örneğin ortasına denk
// geldiyse yarım örnek sayılmaz. Dosya yoksa ya da header'dan kısaysa 0.
function audioBytesIn(file: string): number {
  if (!existsSync(file)) return 0
  const raw = statSync(file).size - WAV_HEADER_BYTES
  return raw > 0 ? raw - (raw % BLOCK_ALIGN) : 0
}

function rewriteHeader(file: string, dataBytes: number): void {
  const fd = openSync(file, 'r+')
  try {
    ftruncateSync(fd, WAV_HEADER_BYTES + dataBytes) // yarım örnek artığını at
    writeWavHeader(fd, dataBytes)
  } finally {
    closeSync(fd)
  }
}
