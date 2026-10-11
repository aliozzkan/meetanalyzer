import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../db/database'
import { createMeetingService, type ActiveRecordings, type MeetingService } from './meeting-service'

// Her çağrıda ilerleyen sahte saat: zaman damgası testleri milisaniye şansına kalmasın.
const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function setup(activeRecordings?: ActiveRecordings): {
  meetings: MeetingService
  db: Db
  recordingsDir: string
  tick: () => void
} {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-recordings-'))
  tempDirs.push(recordingsDir)
  let time = 1_000
  const meetings = createMeetingService({
    db,
    recordingsDir,
    activeRecordings,
    now: () => time
  })
  return { meetings, db, recordingsDir, tick: () => (time += 1_000) }
}

function addAudioFile(recordingsDir: string, meetingId: string): string {
  const dir = join(recordingsDir, meetingId, 'r1')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'mic.wav')
  writeFileSync(file, 'ses')
  return file
}

let recordingSeq = 0
function addRecording(db: Db, meetingId: string): void {
  recordingSeq += 1
  db.prepare('INSERT INTO recordings (id, meeting_id, seq, started_at) VALUES (?, ?, ?, 1)').run(
    `r${recordingSeq}`,
    meetingId,
    recordingSeq
  )
}

describe('Meeting servisi', () => {
  it('başlatılan Meeting seçilen Language ile recording durumunda oluşur', () => {
    const { meetings } = setup()

    const meeting = meetings.start('en')

    expect(meetings.get(meeting.id)).toMatchObject({
      language: 'en',
      state: 'recording',
      recordingCount: 0,
      closedAt: null
    })
  })

  it('bir Meeting recording durumundayken yeni Meeting başlatılamaz', () => {
    const { meetings } = setup()
    meetings.start('tr')

    expect(() => meetings.start('tr')).toThrow(
      expect.objectContaining({ code: 'meeting-already-recording' })
    )
  })

  it("Recording'i olmayan Meeting kapatılamaz", () => {
    const { meetings } = setup()
    const meeting = meetings.start('tr')

    expect(() => meetings.close(meeting.id)).toThrow(
      expect.objectContaining({ code: 'no-recordings' })
    )
    expect(meetings.get(meeting.id).state).toBe('recording')
  })

  it("Recording'i olan Meeting kapatılır ve yeni Meeting başlatılabilir", () => {
    const { meetings, db } = setup()
    const meeting = meetings.start('tr')
    addRecording(db, meeting.id)

    const closed = meetings.close(meeting.id)

    expect(closed.state).toBe('closed')
    expect(closed.closedAt).not.toBeNull()
    expect(() => meetings.start('tr')).not.toThrow()
  })

  it('izinsiz bir geçiş reddedilir ve durum değişmez', () => {
    const { meetings } = setup()
    const meeting = meetings.start('tr')

    expect(() => meetings.transition(meeting.id, 'approved')).toThrow(
      expect.objectContaining({ code: 'invalid-transition' })
    )
    expect(meetings.get(meeting.id).state).toBe('recording')
  })

  it('Closed → Transcribing → Transcribed → Approved zinciri izinlidir ve onay zamanı yazılır', () => {
    const { meetings, db } = setup()
    const meeting = meetings.start('tr')
    addRecording(db, meeting.id)
    meetings.close(meeting.id)

    meetings.transition(meeting.id, 'transcribing')
    meetings.transition(meeting.id, 'transcribed')
    const approved = meetings.transition(meeting.id, 'approved')

    expect(approved.state).toBe('approved')
    expect(approved.approvedAt).not.toBeNull()
  })

  it('Transcription hata verirse Transcribing → Closed izinlidir ve closed_at değişmez', () => {
    const { meetings, db, tick } = setup()
    const meeting = meetings.start('tr')
    addRecording(db, meeting.id)
    const closedAt = meetings.close(meeting.id).closedAt
    meetings.transition(meeting.id, 'transcribing')
    tick()

    const back = meetings.transition(meeting.id, 'closed')

    expect(back.state).toBe('closed')
    expect(back.closedAt).toBe(closedAt)
  })

  it('olmayan Meeting için not-found döner', () => {
    const { meetings } = setup()

    expect(() => meetings.get('yok')).toThrow(expect.objectContaining({ code: 'not-found' }))
  })

  it("silinen Meeting'in kaydı ve ses dosyaları kaldırılır", () => {
    const { meetings, db, recordingsDir } = setup()
    const meeting = meetings.start('tr')
    addRecording(db, meeting.id)
    const audio = addAudioFile(recordingsDir, meeting.id)

    meetings.remove(meeting.id)

    expect(() => meetings.get(meeting.id)).toThrow(expect.objectContaining({ code: 'not-found' }))
    expect(db.prepare('SELECT 1 FROM recordings').all()).toEqual([])
    expect(existsSync(audio)).toBe(false)
    expect(existsSync(join(recordingsDir, meeting.id))).toBe(false)
  })

  it('ses klasörü hiç oluşmamış Meeting de hatasız silinir', () => {
    const { meetings } = setup()
    const meeting = meetings.start('tr')

    expect(() => meetings.remove(meeting.id)).not.toThrow()
  })

  it('Approved Meeting silinemez ve verisi korunur', () => {
    const { meetings, db, recordingsDir } = setup()
    const meeting = meetings.start('tr')
    addRecording(db, meeting.id)
    const audio = addAudioFile(recordingsDir, meeting.id)
    meetings.close(meeting.id)
    for (const to of ['transcribing', 'transcribed', 'approved'] as const) {
      meetings.transition(meeting.id, to)
    }

    expect(() => meetings.remove(meeting.id)).toThrow(
      expect.objectContaining({ code: 'approved-immutable' })
    )
    expect(meetings.get(meeting.id).state).toBe('approved')
    expect(existsSync(audio)).toBe(true)
  })

  it("liste en yeni Meeting'i önce verir ve Recording sayısını içerir", () => {
    const { meetings, db, tick } = setup()
    const first = meetings.start('tr')
    addRecording(db, first.id)
    addRecording(db, first.id)
    meetings.close(first.id)
    tick()
    const second = meetings.start('en')

    expect(meetings.list().map((m) => [m.id, m.recordingCount])).toEqual([
      [second.id, 0],
      [first.id, 2]
    ])
  })

  it('desteklenmeyen Language ile Meeting başlatılamaz', () => {
    const { meetings } = setup()

    expect(() => meetings.start('de' as never)).toThrow(
      expect.objectContaining({ code: 'invalid-input' })
    )
    expect(meetings.list()).toEqual([])
  })

  it('aktif Recording varken Meeting kapatılamaz', () => {
    const active = new Set<string>()
    const { meetings, db } = setup({
      hasActive: (id) => active.has(id),
      abortMeeting: (id) => active.delete(id)
    })
    const meeting = meetings.start('tr')
    addRecording(db, meeting.id)
    active.add(meeting.id)

    expect(() => meetings.close(meeting.id)).toThrow(
      expect.objectContaining({ code: 'recording-active' })
    )
    expect(meetings.get(meeting.id).state).toBe('recording')

    active.delete(meeting.id)
    expect(meetings.close(meeting.id).state).toBe('closed')
  })

  it('Meeting silinmeden önce aktif Recording durdurulur', () => {
    const seenWhileAborting: string[] = []
    const ref: { meetings?: MeetingService } = {}
    const { meetings } = setup({
      hasActive: () => true,
      abortMeeting: (id) => {
        // Silme henüz yapılmamış olmalı: kayıt yazıcısı veri hâlâ varken kapatılır.
        seenWhileAborting.push(ref.meetings!.get(id).id)
      }
    })
    ref.meetings = meetings
    const meeting = meetings.start('tr')

    meetings.remove(meeting.id)

    expect(seenWhileAborting).toEqual([meeting.id])
    expect(() => meetings.get(meeting.id)).toThrow(expect.objectContaining({ code: 'not-found' }))
  })
})
