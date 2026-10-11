import { randomUUID } from 'node:crypto'
import { closeSync, mkdirSync, openSync, rmSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from '../db/database'
import {
  AUDIO_FORMAT,
  BLOCK_ALIGN,
  BYTES_PER_SECOND,
  PCM_CHUNK_MS,
  durationMsFromBytes
} from '../../shared/audio'
import type { RecordingErrorCode, RecordingSummary } from '../../shared/recording'
import { markRecordingEnded } from './recording-rows'
import { createWavHeader, writeWavHeader } from './wav'

export class RecordingError extends Error {
  constructor(
    readonly code: RecordingErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'RecordingError'
  }
}

export type MicrophoneAccess = 'granted' | 'denied'

export interface RecordingServiceOptions {
  db: Db
  recordingsDir: string
  requestMicrophoneAccess: () => Promise<MicrophoneAccess>
  now?: () => number
}

export interface RecordingService {
  start: (meetingId: string) => Promise<RecordingSummary>
  append: (recordingId: string, pcm: Buffer) => void
  stop: (recordingId: string) => RecordingSummary
  // Başlamış ama kullanılamayan bir Recording'i (ör. mikrofon açılamadı) satırı ve dosyasıyla siler.
  discard: (recordingId: string) => void
  // Pencere yenilenirken ya da uygulama kapanırken: aktif Recording'leri düzgünce bitirir.
  stopAll: () => void
  hasActive: (meetingId: string) => boolean
  // Meeting silinirken çağrılır: dosyaları kapatır, kayıt satırlarına dokunmaz (silme cascade'i halleder).
  abortMeeting: (meetingId: string) => void
}

interface ActiveRecording {
  fd: number
  meetingId: string
  seq: number
  startedAt: number
  dataBytes: number
}

// Renderer'dan gelen tek bir parça için üst sınır: parça süresinin iki katı. Normal parçalar bundan
// küçüktür; ele geçirilmiş bir renderer'ın diski doldurmasını sınırlar.
const MAX_CHUNK_BYTES = 2 * (PCM_CHUNK_MS / 1000) * BYTES_PER_SECOND

export function createRecordingService({
  db,
  recordingsDir,
  requestMicrophoneAccess,
  now = Date.now
}: RecordingServiceOptions): RecordingService {
  const active = new Map<string, ActiveRecording>()

  function hasActive(meetingId: string): boolean {
    return [...active.values()].some((recording) => recording.meetingId === meetingId)
  }

  function assertCanStart(meetingId: string): void {
    const meeting = db.prepare('SELECT state FROM meetings WHERE id = ?').get(meetingId) as
      { state: string } | undefined
    if (meeting?.state !== 'recording') {
      throw new RecordingError('meeting-not-recording', 'Bu Meeting için kayıt alınamaz.')
    }
    if (hasActive(meetingId)) {
      throw new RecordingError(
        'recording-already-active',
        'Bu Meeting için bir kayıt zaten sürüyor.'
      )
    }
  }

  async function start(meetingId: string): Promise<RecordingSummary> {
    // Kullanıcıya izin sorusu göstermeden önce kuralları kontrol et.
    assertCanStart(meetingId)
    if ((await requestMicrophoneAccess()) === 'denied') {
      throw new RecordingError(
        'microphone-denied',
        'Mikrofon erişimi verilmedi. Sistem Ayarları > Gizlilik ve Güvenlik > Mikrofon bölümünden izin ver.'
      )
    }
    // İzin penceresi açıkken durum değişmiş olabilir (ör. Meeting silindi, ikinci istek geldi).
    assertCanStart(meetingId)
    const id = randomUUID()
    const relativePath = join(meetingId, id, 'mic.wav')
    const dir = join(recordingsDir, meetingId, id)
    mkdirSync(dir, { recursive: true })
    const fd = openSync(join(dir, 'mic.wav'), 'w')
    // Gerçek boyut bilinmediği için 0 ile yazılır; stop() header'ı gerçek boyutla yeniden yazar.
    writeSync(fd, createWavHeader({ ...AUDIO_FORMAT, dataBytes: 0 }))

    const seq = (
      db
        .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM recordings WHERE meeting_id = ?')
        .get(meetingId) as { next: number }
    ).next
    const startedAt = now()
    try {
      db.transaction(() => {
        db.prepare(
          'INSERT INTO recordings (id, meeting_id, seq, started_at) VALUES (?, ?, ?, ?)'
        ).run(id, meetingId, seq, startedAt)
        db.prepare(
          "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES (?, 'mic', ?)"
        ).run(id, relativePath)
      })()
    } catch (error) {
      closeSync(fd)
      rmSync(dir, { recursive: true, force: true })
      throw error
    }

    active.set(id, { fd, meetingId, seq, startedAt, dataBytes: 0 })
    return { id, meetingId, seq, startedAt, endedAt: null, durationMs: null }
  }

  function getActive(recordingId: string): ActiveRecording {
    const recording = active.get(recordingId)
    if (!recording) {
      throw new RecordingError('unknown-recording', 'Bu kayıt artık sürmüyor.')
    }
    return recording
  }

  function append(recordingId: string, pcm: Buffer): void {
    const recording = getActive(recordingId)
    if (pcm.length % BLOCK_ALIGN !== 0 || pcm.length > MAX_CHUNK_BYTES) {
      throw new RecordingError('invalid-chunk', 'Geçersiz ses parçası.')
    }
    writeSync(recording.fd, pcm)
    recording.dataBytes += pcm.length
  }

  function stop(recordingId: string): RecordingSummary {
    const recording = getActive(recordingId)
    try {
      writeWavHeader(recording.fd, recording.dataBytes)
    } finally {
      // Header yazılamasa bile tanıtıcı kapanır ve Recording aktif kalıp Meeting'i kilitlemez.
      closeSync(recording.fd)
      active.delete(recordingId)
    }

    const endedAt = now()
    const durationMs = durationMsFromBytes(recording.dataBytes)
    markRecordingEnded(db, recordingId, endedAt, durationMs)
    return {
      id: recordingId,
      meetingId: recording.meetingId,
      seq: recording.seq,
      startedAt: recording.startedAt,
      endedAt,
      durationMs
    }
  }

  function discard(recordingId: string): void {
    const recording = getActive(recordingId)
    closeSync(recording.fd)
    active.delete(recordingId)
    db.prepare('DELETE FROM recordings WHERE id = ?').run(recordingId)
    rmSync(join(recordingsDir, recording.meetingId, recordingId), { recursive: true, force: true })
  }

  function stopAll(): void {
    for (const id of [...active.keys()]) {
      try {
        stop(id)
      } catch (error) {
        // Biri başarısız olsa da diğerleri ve uygulamanın kapanışı etkilenmesin.
        console.error('Kayıt bitirilemedi:', id, error)
      }
    }
  }

  function abortMeeting(meetingId: string): void {
    for (const [id, recording] of active) {
      if (recording.meetingId !== meetingId) continue
      closeSync(recording.fd)
      active.delete(id)
    }
  }

  return { start, append, stop, discard, stopAll, hasActive, abortMeeting }
}
