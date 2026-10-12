import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../db/database'
import { createMeetingService } from '../meetings/meeting-service'
import { createApprovalService, purgeApprovedAudio, type ApprovalService } from './approval-service'
import { createTranscriptService, type TranscriptService } from './transcript-service'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function setup(
  state = 'transcribed',
  removeDir?: (path: string) => void
): {
  db: Db
  recordingsDir: string
  transcripts: TranscriptService
  approval: ApprovalService
  audioFile: string
} {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-approve-'))
  tempDirs.push(recordingsDir)
  mkdirSync(join(recordingsDir, 'm1', 'r1'), { recursive: true })
  const audioFile = join(recordingsDir, 'm1', 'r1', 'mic.wav')
  writeFileSync(audioFile, 'ses')

  db.prepare(
    "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', ?, 1)"
  ).run(state)
  db.prepare(
    'INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at, transcribed_at) VALUES (?, ?, 1, 1, 2, 3)'
  ).run('r1', 'm1')
  db.prepare(
    "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES ('r1', 'mic', 'm1/r1/mic.wav')"
  ).run()
  db.prepare(
    'INSERT INTO segments (id, recording_id, seq, start_ms, end_ms) VALUES (?, ?, 1, 0, 1000)'
  ).run('s1', 'r1')
  ;[
    ['Merhaba', 0],
    ['dünyaa', 1],
    ['nasılsın', 0]
  ].forEach(([text, suspect], index) => {
    db.prepare(
      'INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect) VALUES (?, ?, ?, ?, 0, 1, 0.9, ?)'
    ).run(`w${index + 1}`, 's1', index + 1, text, suspect)
  })

  const transcripts = createTranscriptService({ db })
  const meetings = createMeetingService({ db, recordingsDir, now: () => 99 })
  const approval = createApprovalService({ db, recordingsDir, transcripts, meetings, removeDir })
  return { db, recordingsDir, transcripts, approval, audioFile }
}

describe('Approval servisi', () => {
  it('Approved Transcript yazılır, Meeting Approved olur ve ses dosyaları silinir', () => {
    const { approval, transcripts, db, recordingsDir, audioFile } = setup()
    transcripts.correct('w2', 'dünya')

    approval.approve('m1')

    expect(approval.getApprovedText('m1')).toBe('Merhaba dünya nasılsın')
    expect(db.prepare("SELECT state, approved_at FROM meetings WHERE id = 'm1'").get()).toEqual({
      state: 'approved',
      approved_at: 99
    })
    expect(existsSync(audioFile)).toBe(false)
    expect(existsSync(join(recordingsDir, 'm1'))).toBe(false)
    expect(db.prepare('SELECT file_path FROM recording_channels').get()).toEqual({
      file_path: null
    })
  })

  it('düzeltilmemiş Suspect Word olduğu gibi kalır', () => {
    const { approval } = setup()

    approval.approve('m1')

    expect(approval.getApprovedText('m1')).toBe('Merhaba dünyaa nasılsın')
  })

  it('onaydan sonra Correction yazılamaz ve geri alınamaz; metin değişmez', () => {
    const { approval, transcripts } = setup()
    approval.approve('m1')

    expect(() => transcripts.correct('w2', 'x')).toThrow(
      expect.objectContaining({ code: 'not-correctable' })
    )
    expect(() => transcripts.revert('w2')).toThrow(
      expect.objectContaining({ code: 'not-correctable' })
    )
    expect(approval.getApprovedText('m1')).toBe('Merhaba dünyaa nasılsın')
  })

  it('yalnızca Transcribed Meeting onaylanır; iki kez onaylanamaz', () => {
    const closed = setup('closed')
    expect(() => closed.approval.approve('m1')).toThrow(
      expect.objectContaining({ code: 'not-approvable' })
    )
    expect(existsSync(closed.audioFile)).toBe(true)

    const { approval } = setup()
    approval.approve('m1')
    expect(() => approval.approve('m1')).toThrow(
      expect.objectContaining({ code: 'not-approvable' })
    )
    expect(() => approval.approve('yok')).toThrow(
      expect.objectContaining({ code: 'meeting-not-found' })
    )
  })

  it('Approved Transcript yoksa getApprovedText not-approved verir', () => {
    const { approval } = setup()

    expect(() => approval.getApprovedText('m1')).toThrow(
      expect.objectContaining({ code: 'not-approved' })
    )
  })

  it('ses silme başarısız olsa da onay kalır; açılıştaki toparlama silmeyi tamamlar', () => {
    let fail = true
    const { approval, db, recordingsDir, audioFile } = setup('transcribed', (path) => {
      if (fail) throw new Error('EBUSY')
      rmSync(path, { recursive: true, force: true })
    })

    approval.approve('m1')

    expect(approval.getApprovedText('m1')).toBe('Merhaba dünyaa nasılsın')
    expect(existsSync(audioFile)).toBe(true)
    expect(db.prepare('SELECT file_path FROM recording_channels').get()).toEqual({
      file_path: 'm1/r1/mic.wav'
    })

    fail = false
    expect(purgeApprovedAudio({ db, recordingsDir })).toBe(1)
    expect(existsSync(audioFile)).toBe(false)
    expect(db.prepare('SELECT file_path FROM recording_channels').get()).toEqual({
      file_path: null
    })
    expect(purgeApprovedAudio({ db, recordingsDir })).toBe(0)
  })

  it('toparlama yalnızca Approved Meeting seslerine dokunur', () => {
    const { db, recordingsDir, audioFile } = setup('transcribed')

    expect(purgeApprovedAudio({ db, recordingsDir })).toBe(0)
    expect(existsSync(audioFile)).toBe(true)
  })
})
