import type { Language, MeetingSummary } from '../../shared/meeting'
import type { TranscriptionStatus } from '../../shared/transcription'
import type { Db } from '../db/database'
import { MeetingError, type MeetingService } from '../meetings/meeting-service'
import type { PowerGuard } from '../power/power-guard'
import { TranscriptionError } from './errors'

export interface TranscribeJob {
  recordingId: string
  language: Language
  /** Bu Recording için 0–100. */
  onProgress: (percent: number) => void
  signal: AbortSignal
}

export interface TranscriptionQueueOptions {
  db: Db
  meetings: Pick<MeetingService, 'get' | 'transition'>
  power: PowerGuard
  /** Tek bir Recording'i transcribe eder ve sonucunu yazar (üretimde `transcribeRecording`). */
  transcribe: (job: TranscribeJob) => Promise<unknown>
  isModelReady: () => boolean
  onStatus?: (status: TranscriptionStatus) => void
  now?: () => number
}

export interface TranscriptionQueue {
  /** Closed Meeting'i Transcribing yapıp kuyruğa ekler; model yoksa `model-missing` verir. */
  enqueue: (meetingId: string) => MeetingSummary
  /** Meeting'i kuyruktan çıkarır; işleniyorsa çalışan whisper'ı iptal eder. */
  cancelMeeting: (meetingId: string) => void
  getStatus: () => TranscriptionStatus
  /** Uygulama kapanırken çalışan işi iptal eder; Meeting Transcribing kalır, açılışta Closed'a döner. */
  shutdown: () => void
}

interface ActiveJob {
  meetingId: string
  controller: AbortController
  /** İş silme ya da kapanış yüzünden iptal edildi: sonuç (hata, durum geçişi) yazılmaz. */
  stopped: boolean
  percent: number | null
}

const UNEXPECTED_ERROR = 'Transcription beklenmedik bir hatayla durdu.'

// Transcription Queue (ADR-0005): tek işçi, FIFO. Kuyruk satırı Meeting bitene kadar tabloda kalır;
// uygulama bu sırada kapanırsa açılışta `recoverInterruptedTranscriptions` onu temizler.
export function createTranscriptionQueue({
  db,
  meetings,
  power,
  transcribe,
  isModelReady,
  onStatus,
  now = Date.now
}: TranscriptionQueueOptions): TranscriptionQueue {
  let active: ActiveJob | undefined
  let running = false
  let closing = false

  function getStatus(): TranscriptionStatus {
    const rows = db
      .prepare('SELECT meeting_id FROM transcription_queue ORDER BY enqueued_at, rowid')
      .all() as { meeting_id: string }[]
    return {
      active: active ? { meetingId: active.meetingId, percent: active.percent } : null,
      queued: rows.map((row) => row.meeting_id).filter((id) => id !== active?.meetingId)
    }
  }

  function notify(): void {
    // Kapanışta DB kapanmış olabilir; durum sorgulanamaz.
    if (closing) return
    onStatus?.(getStatus())
  }

  function enqueue(meetingId: string): MeetingSummary {
    if (closing) throw new MeetingError('internal-error', 'Uygulama kapanıyor.')
    // Model yoksa durum değiştirilmez: kullanıcı modeli indirip yeniden dener.
    if (meetings.get(meetingId).state === 'closed' && !isModelReady()) {
      throw new MeetingError(
        'model-missing',
        'Transcription için önce modelin indirilmesi gerekir.'
      )
    }
    const meeting = db.transaction(() => {
      const transitioned = meetings.transition(meetingId, 'transcribing')
      db.prepare('INSERT INTO transcription_queue (meeting_id, enqueued_at) VALUES (?, ?)').run(
        meetingId,
        now()
      )
      return transitioned
    })()
    void pump()
    notify()
    return meeting
  }

  function cancelMeeting(meetingId: string): void {
    db.prepare('DELETE FROM transcription_queue WHERE meeting_id = ?').run(meetingId)
    if (active?.meetingId === meetingId) {
      stop(active)
      active = undefined // iptal edilen iş durumda "işleniyor" görünmesin
    }
    notify()
  }

  function shutdown(): void {
    closing = true
    if (active) stop(active)
  }

  function stop(job: ActiveJob): void {
    job.stopped = true
    job.controller.abort()
  }

  // Tek işçi: kuyruk boşalana kadar sırayla Meeting işler. Uyku engeli işçi çalıştığı sürece açık kalır.
  async function pump(): Promise<void> {
    if (running) return
    running = true
    power.acquire('transcription')
    try {
      for (;;) {
        if (closing) break
        const next = nextMeetingId()
        if (!next) break
        await processMeeting(next)
      }
    } finally {
      running = false
      power.release('transcription')
      notify()
    }
  }

  function nextMeetingId(): string | undefined {
    const row = db
      .prepare('SELECT meeting_id FROM transcription_queue ORDER BY enqueued_at, rowid LIMIT 1')
      .get() as { meeting_id: string } | undefined
    return row?.meeting_id
  }

  async function processMeeting(meetingId: string): Promise<void> {
    const job: ActiveJob = {
      meetingId,
      controller: new AbortController(),
      stopped: false,
      percent: null
    }
    active = job
    notify()
    try {
      const { language } = meetings.get(meetingId)
      const recordings = db
        .prepare(
          `SELECT r.id, COALESCE(c.duration_ms, 0) AS duration_ms
           FROM recordings r LEFT JOIN recording_channels c ON c.recording_id = r.id AND c.kind = 'mic'
           WHERE r.meeting_id = ? AND r.transcribed_at IS NULL ORDER BY r.seq`
        )
        .all(meetingId) as { id: string; duration_ms: number }[]
      // Meeting geneli ilerleme, Recording süreleriyle ağırlıklanır (süresi bilinmeyen 1 sayılır).
      const weights = recordings.map((recording) => Math.max(recording.duration_ms, 1))
      const total = weights.reduce((sum, weight) => sum + weight, 0)

      let done = 0
      for (const [index, recording] of recordings.entries()) {
        try {
          await transcribe({
            recordingId: recording.id,
            language,
            signal: job.controller.signal,
            onProgress: (percent) => {
              if (job.stopped) return
              job.percent = Math.round(((done + (weights[index] * percent) / 100) / total) * 100)
              notify()
            }
          })
        } catch (error) {
          // Zaten metne dökülmüş Recording hata değildir (başka yoldan bitmiş); kalanlara geçilir.
          if (!(error instanceof TranscriptionError && error.code === 'already-transcribed')) {
            throw error
          }
        }
        done += weights[index]
        job.percent = Math.round((done / total) * 100)
        notify()
      }
      if (job.stopped) return
      finish(meetingId, 'transcribed')
    } catch (error) {
      if (job.stopped) return // silme ya da kapanış: yazılacak bir sonuç yok
      finish(meetingId, 'closed', describe(error))
    } finally {
      active = undefined
    }
  }

  // Kuyruk satırını siler ve durumu tek işlemde geçirir; Meeting o arada silinmişse sessizce geçilir.
  // Yazma başarısız olursa kuyruk satırı yine de silinir (aksi halde işçi aynı Meeting'de sonsuza dek döner)
  // ve Meeting elinden geldiğince Closed'a çekilir; o da olmazsa açılıştaki toparlama düzeltir.
  function finish(meetingId: string, to: 'transcribed' | 'closed', lastError?: string): void {
    try {
      db.transaction(() => {
        db.prepare('DELETE FROM transcription_queue WHERE meeting_id = ?').run(meetingId)
        meetings.transition(meetingId, to, lastError)
      })()
    } catch (error) {
      console.error('Transcription sonucu yazılamadı:', error)
      try {
        db.prepare('DELETE FROM transcription_queue WHERE meeting_id = ?').run(meetingId)
        db.prepare(
          "UPDATE meetings SET state = 'closed', last_error = ? WHERE id = ? AND state = 'transcribing'"
        ).run(lastError ?? UNEXPECTED_ERROR, meetingId)
      } catch (fallbackError) {
        console.error('Transcription durumu geri alınamadı:', fallbackError)
      }
    }
  }

  return { enqueue, cancelMeeting, getStatus, shutdown }
}

function describe(error: unknown): string {
  if (error instanceof TranscriptionError) return error.message
  console.error('Transcription hatası:', error)
  return UNEXPECTED_ERROR
}

// Açılışta: Transcription sürerken kapanan Meeting'ler Closed'a döner ve kuyruk temizlenir.
// Tamamlanmış Recording'lerin sonuçları kalır; yeniden başlatmada yalnızca kalanlar işlenir.
export function recoverInterruptedTranscriptions(db: Db): number {
  return db.transaction(() => {
    const { changes } = db
      .prepare("UPDATE meetings SET state = 'closed' WHERE state = 'transcribing'")
      .run()
    db.prepare('DELETE FROM transcription_queue').run()
    return changes
  })()
}
