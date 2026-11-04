import { closeSync, existsSync, ftruncateSync, openSync, rmSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { BLOCK_ALIGN, durationMsFromBytes, type AudioChannel } from '../../shared/audio'
import type { Db } from '../db/database'
import { resolveRecordingFile } from './recording-paths'
import { markRecordingEnded } from './recording-rows'
import { WAV_HEADER_BYTES, writeWavHeader } from './wav'

export interface RecoveryResult {
  repaired: number
  discarded: number
  /** İşlenemeyen Recording'ler (geçersiz yol, dosya sistemi hatası); bunlar loglanır ve atlanır. */
  failed: number
}

interface InterruptedRow {
  id: string
  started_at: number
  kind: AudioChannel
  file_path: string
}

interface InterruptedRecording {
  id: string
  startedAt: number
  channels: { kind: AudioChannel; filePath: string }[]
}

// Uygulama kayıt sırasında çöktüyse (kill -9, elektrik kesintisi) açılışta `ended_at`'i boş kalan
// Recording'leri toparlar. Aktif Recording yalnızca bellekte izlenir; açılışta kalan her bu tür satır
// bir çökme artığıdır. IPC kaydedilmeden önce çalıştırılmalıdır.
//   - Her kanalın dosyası ayrı onarılır: yarım örnek kesilir, header gerçek boyutla yeniden yazılır. Recording'in
//     süresi ve `ended_at`'i en kısa kanala göre belirlenir (kanallar aynı anda başladığı için fazlası eşlenemez).
//   - Kanallardan biri ses içermiyorsa (boş, header'ı yarım, dosyası hiç olmayan) Recording bütün olarak satırı,
//     dosyaları ve klasörüyle silinir: tek kanallı bir kayıt iki kanallı toplantıyı temsil etmez.
// Meeting durumuna dokunulmaz. Bir Recording'in hatası diğerlerinin toparlanmasını engellemez.
// Her adım yeniden çalıştırmaya dayanıklıdır: dosya boyutundan yeniden hesaplanır; silmede önce dosyalar,
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
      `SELECT r.id, r.started_at, c.kind, c.file_path
       FROM recordings r JOIN recording_channels c ON c.recording_id = r.id
       WHERE r.ended_at IS NULL
       ORDER BY r.started_at, r.id, c.kind`
    )
    .all() as InterruptedRow[]

  const recordings = new Map<string, InterruptedRecording>()
  for (const row of rows) {
    const recording = recordings.get(row.id) ?? {
      id: row.id,
      startedAt: row.started_at,
      channels: []
    }
    recording.channels.push({ kind: row.kind, filePath: row.file_path })
    recordings.set(row.id, recording)
  }

  const result: RecoveryResult = { repaired: 0, discarded: 0, failed: 0 }
  for (const recording of recordings.values()) {
    try {
      const outcome = recoverRecording(db, recordingsDir, recording)
      result[outcome] += 1
    } catch (error) {
      console.error('Kayıt toparlanamadı:', recording.id, error)
      result.failed += 1
    }
  }
  return result
}

function recoverRecording(
  db: Db,
  recordingsDir: string,
  recording: InterruptedRecording
): 'repaired' | 'discarded' {
  // Önce tüm yollar doğrulanır; beklenmeyen bir yol hiçbir dosyaya dokunmadan hata verir.
  const files = recording.channels.map((channel) => ({
    kind: channel.kind,
    path: resolveRecordingFile(recordingsDir, channel.filePath)
  }))
  const sizes = files.map((file) => ({ ...file, dataBytes: audioBytesIn(file.path) }))

  if (sizes.some((file) => file.dataBytes === 0)) {
    for (const dir of new Set(files.map((file) => dirname(file.path)))) {
      rmSync(dir, { recursive: true, force: true })
    }
    db.prepare('DELETE FROM recordings WHERE id = ?').run(recording.id)
    return 'discarded'
  }

  const durations: Partial<Record<AudioChannel, number>> = {}
  for (const file of sizes) {
    rewriteHeader(file.path, file.dataBytes)
    durations[file.kind] = durationMsFromBytes(file.dataBytes)
  }
  const shortest = Math.min(...Object.values(durations))
  markRecordingEnded(db, recording.id, recording.startedAt + shortest, durations)
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
