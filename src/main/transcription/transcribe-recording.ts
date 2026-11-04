import { randomUUID } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import type { AudioChannel } from '../../shared/audio'
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
  /** Recording için 0–100; ilerleme, işlenecek kanal sayısına göre eşit bölünür. */
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
}

interface ChannelRow {
  kind: AudioChannel
  file_path: string | null
  transcribed_at: number | null
}

const EMPTY_RESULT: TranscribeResult = { segments: 0, words: 0, suspects: 0 }

// Bir Recording'in henüz işlenmemiş kanallarını sırayla (mic, system) transcribe eder. Her kanalın sonucu
// (segment, kelime, Suspect Word işareti) kendi veritabanı işleminde yazılır ve kanal işlenmiş işaretlenir: çalıştırıcı
// hata verirse, iptal edilirse ya da çıktı bozuksa o kanal için hiçbir şey yazılmaz (yarım Transcript kalmaz) ama daha önce
// bitmiş kanallar korunur; yeniden başlatmada yalnızca kalan kanallar işlenir. Tüm kanallar bitince Recording işlenmiş sayılır.
// Yalnızca `mic` kanalı olan eski Recording'ler tek kanallı işlenir.
export async function transcribeRecording(
  options: TranscribeRecordingOptions
): Promise<TranscribeResult> {
  const { db, recordingId, now = Date.now, run = runWhisper } = options

  const recording = db
    .prepare('SELECT ended_at, transcribed_at FROM recordings WHERE id = ?')
    .get(recordingId) as RecordingRow | undefined
  if (!recording) throw notFound()
  if (recording.transcribed_at !== null) throw alreadyTranscribed()
  // Kayıt sürerken ya da kurtarılmamışken WAV header'ı henüz gerçek boyutu göstermez (issue 03/04).
  if (recording.ended_at === null) {
    throw new TranscriptionError('recording-not-finished', 'Kayıt henüz bitmemiş.')
  }

  const channels = db
    .prepare(
      'SELECT kind, file_path, transcribed_at FROM recording_channels WHERE recording_id = ? ORDER BY kind'
    )
    .all(recordingId) as ChannelRow[]
  if (channels.length === 0) {
    throw new TranscriptionError('audio-missing', 'Kaydın ses dosyası bulunamadı.')
  }
  const remaining = channels.filter((channel) => channel.transcribed_at === null)

  // Tüm kanallar işlenmiş ama Recording işaretlenmemiş (arada kapanma): yalnızca işaret tamamlanır.
  if (remaining.length === 0) {
    db.transaction(() => completeRecording(db, recordingId, now()))()
    return { ...EMPTY_RESULT }
  }

  const total = { ...EMPTY_RESULT }
  for (const [index, channel] of remaining.entries()) {
    if (options.signal?.aborted) {
      throw new TranscriptionError('cancelled', 'Transcription iptal edildi.')
    }
    const result = await transcribeChannel({
      ...options,
      run,
      now,
      channel,
      onProgress: (percent) =>
        options.onProgress?.(((index + percent / 100) / remaining.length) * 100)
    })
    total.segments += result.segments
    total.words += result.words
    total.suspects += result.suspects
  }
  return total
}

async function transcribeChannel(
  options: TranscribeRecordingOptions & {
    channel: ChannelRow
    run: NonNullable<TranscribeRecordingOptions['run']>
    now: () => number
  }
): Promise<TranscribeResult> {
  const { db, recordingsDir, recordingId, channel, now, run } = options
  const wavPath = audioPath(recordingsDir, channel.file_path)

  // Hiç ses içermeyen kanal (ör. kayıt başlar başlamaz durduruldu): gerçek whisper boş WAV'ı "failed to read
  // audio" ile reddeder (çıkış 11) ve kayıt sonsuza dek yeniden denenirdi. Sıfır segmentle tamamlanır.
  if (statSync(wavPath).size <= WAV_HEADER_BYTES) {
    db.transaction(() => store(db, recordingId, channel.kind, [], now()))()
    return { ...EMPTY_RESULT }
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

  db.transaction(() => store(db, recordingId, channel.kind, segments, now()))()
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

// Tüm kanalları işlenmişse Recording'i işlenmiş işaretler. Bir işlemin içinde çalışır.
function completeRecording(db: Db, recordingId: string, transcribedAt: number): void {
  const pending = db
    .prepare(
      'SELECT COUNT(*) FROM recording_channels WHERE recording_id = ? AND transcribed_at IS NULL'
    )
    .pluck()
    .get(recordingId) as number
  if (pending === 0) {
    db.prepare('UPDATE recordings SET transcribed_at = ? WHERE id = ?').run(
      transcribedAt,
      recordingId
    )
  }
}

// Bir işlemin içinde çalışır; herhangi bir hata işlemi geri alır.
function store(
  db: Db,
  recordingId: string,
  channel: AudioChannel,
  segments: ParsedSegment[],
  transcribedAt: number
): void {
  const current = db
    .prepare(
      `SELECT r.transcribed_at AS recording_done, c.transcribed_at AS channel_done
       FROM recordings r LEFT JOIN recording_channels c ON c.recording_id = r.id AND c.kind = ?
       WHERE r.id = ?`
    )
    .get(channel, recordingId) as
    { recording_done: number | null; channel_done: number | null } | undefined
  // Transcription sürerken Recording silinmiş ya da başka bir yoldan bitirilmiş olabilir.
  if (!current) throw notFound()
  if (current.recording_done !== null || current.channel_done !== null) throw alreadyTranscribed()

  // Segment numaraları Recording içinde sürer: diğer kanalın segmentlerinden sonra devam eder.
  const base = db
    .prepare('SELECT COALESCE(MAX(seq), 0) FROM segments WHERE recording_id = ?')
    .pluck()
    .get(recordingId) as number
  const insertSegment = db.prepare(
    'INSERT INTO segments (id, recording_id, seq, start_ms, end_ms, channel) VALUES (?, ?, ?, ?, ?, ?)'
  )
  const insertWord = db.prepare(
    `INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  segments.forEach((segment, segmentIndex) => {
    const segmentId = randomUUID()
    insertSegment.run(
      segmentId,
      recordingId,
      base + segmentIndex + 1,
      segment.startMs,
      segment.endMs,
      channel
    )
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
  db.prepare(
    'UPDATE recording_channels SET transcribed_at = ? WHERE recording_id = ? AND kind = ?'
  ).run(transcribedAt, recordingId, channel)
  completeRecording(db, recordingId, transcribedAt)
}
