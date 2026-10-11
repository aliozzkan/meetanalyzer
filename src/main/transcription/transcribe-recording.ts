import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import type { Language } from '../../shared/meeting'
import type { Db } from '../db/database'
import { resolveRecordingFile } from '../recordings/recording-paths'
import { WAV_HEADER_BYTES } from '../recordings/wav'
import { TranscriptionError } from './errors'
import { parseVadSegments, parseWhisperOutput, type ParsedSegment } from './whisper-parser'
import { runWhisper, type RunWhisperOptions, type WhisperRun } from './whisper-runner'

export interface TranscribeRecordingOptions {
  db: Db
  recordingsDir: string
  recordingId: string
  /** Meeting'in Language'ı. */
  language: Language
  suspectThreshold: number
  whisper: Pick<RunWhisperOptions, 'cliPath' | 'modelPath' | 'vadModelPath' | 'threads' | 'nice'>
  onProgress?: (percent: number) => void
  signal?: AbortSignal
  now?: () => number
  /** Çalıştırıcı (testlerde sahtesi verilir). */
  run?: (options: RunWhisperOptions) => Promise<WhisperRun>
}

export interface TranscribeResult {
  segments: number
  words: number
  suspects: number
}

interface RecordingRow {
  ended_at: number | null
  transcribed_at: number | null
  file_path: string | null
}

// Tek bir Recording'i transcribe eder ve sonucu (segment, kelime, Suspect Word işareti) tek bir veritabanı
// işleminde yazar. Çalıştırıcı hata verirse, iptal edilirse ya da çıktı bozuksa ya da yazma sırasında
// herhangi bir hata olursa hiçbir şey yazılmaz: yarım Transcript kalmaz.
export async function transcribeRecording(
  options: TranscribeRecordingOptions
): Promise<TranscribeResult> {
  const { db, recordingsDir, recordingId, now = Date.now, run = runWhisper } = options

  const recording = db
    .prepare(
      `SELECT r.ended_at, r.transcribed_at, c.file_path
       FROM recordings r LEFT JOIN recording_channels c ON c.recording_id = r.id AND c.kind = 'mic'
       WHERE r.id = ?`
    )
    .get(recordingId) as RecordingRow | undefined
  if (!recording) throw notFound()
  if (recording.transcribed_at !== null) throw alreadyTranscribed()
  // Kayıt sürerken ya da kurtarılmamışken WAV header'ı henüz gerçek boyutu göstermez (issue 03/04).
  if (recording.ended_at === null) {
    throw new TranscriptionError('recording-not-finished', 'Kayıt henüz bitmemiş.')
  }
  const wavPath = audioPath(recordingsDir, recording.file_path)

  // Hiç ses içermeyen kayıt (ör. kayıt başlar başlamaz durduruldu): gerçek whisper boş WAV'ı "failed to read
  // audio" ile reddeder (çıkış 11) ve kayıt sonsuza dek yeniden denenirdi. Sıfır segmentle tamamlanır.
  if (statSync(wavPath).size <= WAV_HEADER_BYTES) {
    db.transaction(() => store(db, recordingId, [], now()))()
    return { segments: 0, words: 0, suspects: 0 }
  }

  const { json, stderr } = await run({
    ...options.whisper,
    wavPath,
    language: options.language,
    onProgress: options.onProgress,
    signal: options.signal
  })
  // Çalıştırıcı iptal sinyalini yok sayıp dönmüş olabilir: iptal edilmişse hiçbir şey yazılmaz.
  if (options.signal?.aborted) {
    throw new TranscriptionError('cancelled', 'Transcription iptal edildi.')
  }
  const segments = parseWhisperOutput(json, {
    vadSegments: parseVadSegments(stderr),
    suspectThreshold: options.suspectThreshold
  })

  db.transaction(() => store(db, recordingId, segments, now()))()
  return {
    segments: segments.length,
    words: segments.reduce((total, segment) => total + segment.words.length, 0),
    suspects: segments.reduce(
      (total, segment) => total + segment.words.filter((word) => word.isSuspect).length,
      0
    )
  }
}

function notFound(): TranscriptionError {
  return new TranscriptionError('recording-not-found', 'Kayıt bulunamadı.')
}

function alreadyTranscribed(): TranscriptionError {
  return new TranscriptionError('already-transcribed', 'Bu kayıt zaten metne dökülmüş.')
}

// DB'deki göreli yolu doğrular ve dosyanın varlığını denetler; kod dışı hata sızdırmaz.
function audioPath(recordingsDir: string, filePath: string | null): string {
  const missing = (): TranscriptionError =>
    new TranscriptionError('audio-missing', 'Kaydın ses dosyası bulunamadı.')
  if (!filePath) throw missing()
  let path: string
  try {
    path = resolveRecordingFile(recordingsDir, filePath)
  } catch {
    throw missing() // beklenmeyen ya da kayıt klasörü dışına çıkan yol
  }
  if (!existsSync(path)) throw missing()
  return path
}

// Bir işlemin içinde çalışır; herhangi bir hata işlemi geri alır.
function store(
  db: Db,
  recordingId: string,
  segments: ParsedSegment[],
  transcribedAt: number
): void {
  const current = db
    .prepare('SELECT transcribed_at FROM recordings WHERE id = ?')
    .get(recordingId) as { transcribed_at: number | null } | undefined
  // Transcription sürerken Recording silinmiş ya da başka bir yoldan bitirilmiş olabilir.
  if (!current) throw notFound()
  if (current.transcribed_at !== null) throw alreadyTranscribed()

  const insertSegment = db.prepare(
    'INSERT INTO segments (id, recording_id, seq, start_ms, end_ms) VALUES (?, ?, ?, ?, ?)'
  )
  const insertWord = db.prepare(
    `INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  segments.forEach((segment, segmentIndex) => {
    const segmentId = randomUUID()
    insertSegment.run(segmentId, recordingId, segmentIndex + 1, segment.startMs, segment.endMs)
    segment.words.forEach((word, wordIndex) => {
      insertWord.run(
        randomUUID(),
        segmentId,
        wordIndex + 1,
        word.text,
        word.startMs,
        word.endMs,
        word.confidence,
        word.isSuspect ? 1 : 0
      )
    })
  })
  db.prepare('UPDATE recordings SET transcribed_at = ? WHERE id = ?').run(
    transcribedAt,
    recordingId
  )
}
