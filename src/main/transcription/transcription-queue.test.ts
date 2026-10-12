import { describe, expect, it } from 'vitest'
import type { MeetingState } from '../../shared/meeting'
import type { TranscriptionStatus } from '../../shared/transcription'
import { openDatabase, type Db } from '../db/database'
import { createMeetingService, type MeetingService } from '../meetings/meeting-service'
import { createPowerGuard } from '../power/power-guard'
import { TranscriptionError } from './errors'
import {
  createTranscriptionQueue,
  recoverInterruptedTranscriptions,
  type TranscribeJob,
  type TranscriptionQueue
} from './transcription-queue'

interface Pending {
  job: TranscribeJob
  resolve: () => void
  reject: (error: unknown) => void
}

// Gerçek transcribeRecording gibi başarıda recordings.transcribed_at'i yazan, ama bitişi testin
// elinde olan sahte çalıştırıcı.
function setup(options: { modelReady?: boolean } = {}): {
  db: Db
  meetings: MeetingService
  queue: TranscriptionQueue
  pending: Pending[]
  calls: string[]
  powerEvents: string[]
  statuses: TranscriptionStatus[]
  addMeeting: (recordings: number, state?: MeetingState) => string
  finishNext: () => Promise<void>
  failNext: (error: unknown) => Promise<void>
} {
  const db = openDatabase(':memory:')
  const meetings = createMeetingService({ db, recordingsDir: '/nonexistent' })
  const pending: Pending[] = []
  const calls: string[] = []
  const powerEvents: string[] = []
  const statuses: TranscriptionStatus[] = []
  const power = createPowerGuard({
    start: () => {
      powerEvents.push('start')
      return powerEvents.length
    },
    stop: () => {
      powerEvents.push('stop')
    }
  })
  const queue = createTranscriptionQueue({
    db,
    meetings,
    power,
    isModelReady: () => options.modelReady ?? true,
    onStatus: (status) => statuses.push(status),
    transcribe: (job) =>
      new Promise<void>((resolve, reject) => {
        calls.push(job.recordingId)
        job.signal.addEventListener('abort', () => {
          pending.splice(0, pending.length, ...pending.filter((entry) => entry.job !== job))
          reject(new TranscriptionError('cancelled', 'Transcription iptal edildi.'))
        })
        pending.push({
          job,
          resolve: () => {
            db.prepare('UPDATE recordings SET transcribed_at = 1 WHERE id = ?').run(job.recordingId)
            resolve()
          },
          reject
        })
      })
  })

  let meetingSeq = 0
  function addMeeting(recordings: number, state: MeetingState = 'closed'): string {
    meetingSeq += 1
    const id = `m${meetingSeq}`
    db.prepare("INSERT INTO meetings (id, language, state, created_at) VALUES (?, 'tr', ?, ?)").run(
      id,
      state,
      meetingSeq
    )
    for (let seq = 1; seq <= recordings; seq += 1) {
      db.prepare(
        'INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at) VALUES (?, ?, ?, 1, 2)'
      ).run(`${id}-r${seq}`, id, seq)
    }
    return id
  }

  // Bir sonraki bekleyen transcribe çağrısını tamamlar ve kuyruğun ilerlemesine izin verir.
  async function settle(): Promise<void> {
    await new Promise((resolve) => setImmediate(resolve))
  }
  async function finishNext(): Promise<void> {
    await settle()
    pending.shift()!.resolve()
    await settle()
  }
  async function failNext(error: unknown): Promise<void> {
    await settle()
    pending.shift()!.reject(error)
    await settle()
  }

  return {
    db,
    meetings,
    queue,
    pending,
    calls,
    powerEvents,
    statuses,
    addMeeting,
    finishNext,
    failNext
  }
}

describe('Transcription Queue', () => {
  it("Meeting'in Recording'lerini seq sırasıyla işler ve bitince Transcribed olur", async () => {
    const { queue, meetings, calls, addMeeting, finishNext } = setup()
    const id = addMeeting(2)

    expect(queue.enqueue(id).state).toBe('transcribing')
    await finishNext()
    expect(meetings.get(id).state).toBe('transcribing')
    await finishNext()

    expect(calls).toEqual([`${id}-r1`, `${id}-r2`])
    expect(meetings.get(id).state).toBe('transcribed')
    expect(queue.getStatus()).toEqual({ active: null, queued: [] })
  })

  it("ikinci Meeting 'Sırada' bekler ve birincisi bitince başlar (FIFO)", async () => {
    const { queue, calls, addMeeting, finishNext } = setup()
    const first = addMeeting(1)
    const second = addMeeting(1)

    queue.enqueue(first)
    queue.enqueue(second)
    await new Promise((resolve) => setImmediate(resolve))

    expect(calls).toEqual([`${first}-r1`])
    expect(queue.getStatus()).toEqual({
      active: { meetingId: first, percent: null },
      queued: [second]
    })

    await finishNext()
    expect(calls).toEqual([`${first}-r1`, `${second}-r1`])
    expect(queue.getStatus().active?.meetingId).toBe(second)
    expect(queue.getStatus().queued).toEqual([])
  })

  it('yalnızca henüz transcribe edilmemiş Recording işlenir', async () => {
    const { queue, db, calls, addMeeting, finishNext } = setup()
    const id = addMeeting(3)
    db.prepare('UPDATE recordings SET transcribed_at = 1 WHERE id = ?').run(`${id}-r1`)

    queue.enqueue(id)
    await finishNext()
    await finishNext()

    expect(calls).toEqual([`${id}-r2`, `${id}-r3`])
  })

  it("hata Meeting'i mesajla Closed'a döndürür, kuyruktan çıkarır ve tamamlananları korur", async () => {
    const { queue, meetings, db, addMeeting, finishNext, failNext } = setup()
    const failing = addMeeting(2)
    const next = addMeeting(1)
    queue.enqueue(failing)
    queue.enqueue(next)

    await finishNext()
    await failNext(new TranscriptionError('whisper-failed', 'whisper çöktü'))

    expect(meetings.get(failing)).toMatchObject({ state: 'closed', lastError: 'whisper çöktü' })
    expect(
      db.prepare('SELECT transcribed_at FROM recordings WHERE id = ?').get(`${failing}-r1`)
    ).toEqual({ transcribed_at: 1 })
    expect(
      db.prepare('SELECT 1 FROM transcription_queue WHERE meeting_id = ?').get(failing)
    ).toBeUndefined()
    // Kuyruk durmaz: sıradaki Meeting işlenmeye başlar.
    expect(queue.getStatus().active?.meetingId).toBe(next)
  })

  it('beklenmeyen hata da kullanıcıya anlaşılır bir mesajla Closed olur', async () => {
    const { queue, meetings, addMeeting, failNext } = setup()
    const id = addMeeting(1)
    queue.enqueue(id)

    await failNext(new Error('ENOSPC'))

    const meeting = meetings.get(id)
    expect(meeting.state).toBe('closed')
    expect(meeting.lastError).toMatch(/beklenmedik/i)
  })

  it('hatadan sonra yeniden başlatınca yalnızca kalan Recording işlenir', async () => {
    const { queue, calls, addMeeting, finishNext, failNext } = setup()
    const id = addMeeting(2)
    queue.enqueue(id)
    await finishNext()
    await failNext(new TranscriptionError('whisper-failed', 'hata'))

    queue.enqueue(id)
    await finishNext()

    expect(calls).toEqual([`${id}-r1`, `${id}-r2`, `${id}-r2`])
  })

  it('ilerleme Meeting geneline Recording süreleriyle ağırlıklanarak yansır', async () => {
    const { queue, db, pending, addMeeting, finishNext } = setup()
    const id = addMeeting(2)
    db.prepare(
      "INSERT INTO recording_channels (recording_id, kind, duration_ms) VALUES (?, 'mic', 30000)"
    ).run(`${id}-r1`)
    db.prepare(
      "INSERT INTO recording_channels (recording_id, kind, duration_ms) VALUES (?, 'mic', 10000)"
    ).run(`${id}-r2`)
    queue.enqueue(id)
    await new Promise((resolve) => setImmediate(resolve))

    pending[0].job.onProgress(50)
    expect(queue.getStatus().active?.percent).toBe(38) // 15 000 / 40 000

    await finishNext()
    expect(queue.getStatus().active?.percent).toBe(75) // r1 bitti, r2 henüz başlamadı
    pending[0].job.onProgress(100)
    expect(queue.getStatus().active?.percent).toBe(100)
  })

  it('kuyruk çalışırken uyku engeli alınır ve boşalınca bırakılır', async () => {
    const { queue, powerEvents, addMeeting, finishNext } = setup()
    const first = addMeeting(1)
    const second = addMeeting(1)

    queue.enqueue(first)
    queue.enqueue(second)
    await finishNext()
    expect(powerEvents).toEqual(['start']) // Meeting'ler arasında bırakılmaz
    await finishNext()

    expect(powerEvents).toEqual(['start', 'stop'])
  })

  it('model hazır değilse Transcribe reddedilir ve Meeting Closed kalır', () => {
    const { queue, meetings, addMeeting } = setup({ modelReady: false })
    const id = addMeeting(1)

    expect(() => queue.enqueue(id)).toThrow(expect.objectContaining({ code: 'model-missing' }))
    expect(meetings.get(id).state).toBe('closed')
  })

  it('yalnızca Closed Meeting kuyruğa alınır', () => {
    const { queue, addMeeting } = setup()
    const id = addMeeting(1, 'transcribed')

    expect(() => queue.enqueue(id)).toThrow(expect.objectContaining({ code: 'invalid-transition' }))
  })

  it('sıradaki Meeting silinince kuyruktan çıkar ve işlenmez', async () => {
    const { queue, meetings, calls, addMeeting, finishNext } = setup()
    const first = addMeeting(1)
    const second = addMeeting(1)
    queue.enqueue(first)
    queue.enqueue(second)

    meetings.remove(second)
    await finishNext()

    expect(calls).toEqual([`${first}-r1`])
    expect(queue.getStatus()).toEqual({ active: null, queued: [] })
  })

  it('işlenen Meeting silinince whisper iptal edilir, hata yazılmaz ve kuyruk devam eder', async () => {
    const { queue, meetings, calls, db, addMeeting, finishNext } = setup()
    const first = addMeeting(2)
    const second = addMeeting(1)
    const withQueue = createMeetingService({
      db,
      recordingsDir: '/nonexistent',
      activeTranscriptions: queue
    })
    queue.enqueue(first)
    queue.enqueue(second)
    await new Promise((resolve) => setImmediate(resolve))

    withQueue.remove(first)
    await new Promise((resolve) => setImmediate(resolve))

    expect(() => meetings.get(first)).toThrow(expect.objectContaining({ code: 'not-found' }))
    expect(calls).toEqual([`${first}-r1`, `${second}-r1`])
    await finishNext()
    expect(meetings.get(second).state).toBe('transcribed')
  })

  it('shutdown çalışan işi iptal eder; Meeting Transcribing kalır ve açılışta Closed olur', async () => {
    const { queue, meetings, db, addMeeting } = setup()
    const id = addMeeting(1)
    queue.enqueue(id)
    await new Promise((resolve) => setImmediate(resolve))

    queue.shutdown()
    await new Promise((resolve) => setImmediate(resolve))
    expect(meetings.get(id)).toMatchObject({ state: 'transcribing', lastError: null })

    expect(recoverInterruptedTranscriptions(db)).toBe(1)
    expect(meetings.get(id).state).toBe('closed')
    expect(db.prepare('SELECT COUNT(*) AS n FROM transcription_queue').get()).toEqual({ n: 0 })
  })

  it('durum değişiklikleri onStatus ile bildirilir', async () => {
    const { queue, statuses, addMeeting, finishNext } = setup()
    const id = addMeeting(1)

    queue.enqueue(id)
    await finishNext()

    expect(statuses.at(0)?.active?.meetingId).toBe(id)
    expect(statuses.at(-1)).toEqual({ active: null, queued: [] })
  })
})

describe('recoverInterruptedTranscriptions', () => {
  it("Transcribing Meeting'leri Closed'a döndürür, diğerlerine dokunmaz", () => {
    const { db, meetings, addMeeting } = setup()
    const interrupted = addMeeting(1, 'transcribing')
    const done = addMeeting(1, 'transcribed')
    db.prepare('INSERT INTO transcription_queue (meeting_id, enqueued_at) VALUES (?, 1)').run(
      interrupted
    )

    expect(recoverInterruptedTranscriptions(db)).toBe(1)

    expect(meetings.get(interrupted).state).toBe('closed')
    expect(meetings.get(done).state).toBe('transcribed')
  })
})
