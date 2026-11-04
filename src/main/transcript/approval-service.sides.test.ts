import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../db/database'
import { createMeetingService } from '../meetings/meeting-service'
import { createApprovalService, type ApprovalService } from './approval-service'
import { createTranscriptService } from './transcript-service'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function setup(): { db: Db; approval: ApprovalService } {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-approve-'))
  tempDirs.push(recordingsDir)
  db.exec(`
    INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'transcribed', 1);
    INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at, transcribed_at)
      VALUES ('r1', 'm1', 1, 1, 2, 3);
    INSERT INTO segments (id, recording_id, seq, start_ms, end_ms, channel) VALUES
      ('s1', 'r1', 1, 0, 800, 'system'),
      ('s2', 'r1', 2, 2000, 2800, 'mic');
    INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect) VALUES
      ('w1', 's1', 1, 'Merhaba', 0, 400, 0.9, 0),
      ('w2', 's1', 2, 'ekip', 400, 800, 0.3, 1),
      ('w3', 's2', 1, 'Selam', 2000, 2400, 0.9, 0),
      ('w4', 's2', 2, 'hepinize', 2400, 2800, 0.9, 0);
    INSERT INTO corrections (word_id, original, corrected, language, created_at)
      VALUES ('w2', 'ekip', 'ekibi', 'tr', 1);
  `)
  const meetings = createMeetingService({ db, recordingsDir })
  const transcripts = createTranscriptService({ db })
  return { db, approval: createApprovalService({ db, recordingsDir, transcripts, meetings }) }
}

describe('Approved Transcript: Side blokları', () => {
  it('onayda sıralı (side, text) blokları saklanır; düz metin “Diğerleri: …” / “Sen: …” bloklarıdır', () => {
    const { approval } = setup()

    approval.approve('m1')

    expect(approval.getApproved('m1')).toEqual({
      blocks: [
        { side: 'others', text: 'Merhaba ekibi' },
        { side: 'self', text: 'Selam hepinize' }
      ],
      text: 'Diğerleri: Merhaba ekibi\n\nSen: Selam hepinize'
    })
    expect(approval.getApprovedText('m1')).toBe('Diğerleri: Merhaba ekibi\n\nSen: Selam hepinize')
  })

  it('onaydan sonra Approved Transcript değişmez (ham veri değişse de dondurulmuş bloklar aynı kalır)', () => {
    const { db, approval } = setup()
    approval.approve('m1')
    const before = approval.getApproved('m1')

    db.exec("UPDATE words SET text = 'DEĞİŞTİ'; DELETE FROM corrections")

    expect(approval.getApproved('m1')).toEqual(before)
    expect(() => approval.approve('m1')).toThrow()
  })

  it('Side bilgisinden önce onaylanmış tek metinli Transcript bozulmadan okunur ve tek Self bloğu sayılır', () => {
    const { db, approval } = setup()
    db.exec(`
      INSERT INTO meetings (id, language, state, created_at) VALUES ('old', 'tr', 'approved', 1);
      INSERT INTO approved_transcripts (meeting_id, text, created_at) VALUES ('old', 'eski metin', 5);
      INSERT INTO meetings (id, language, state, created_at) VALUES ('empty', 'tr', 'approved', 1);
      INSERT INTO approved_transcripts (meeting_id, text, created_at) VALUES ('empty', '', 5);
    `)

    expect(approval.getApproved('old')).toEqual({
      blocks: [{ side: 'self', text: 'eski metin' }],
      text: 'eski metin'
    })
    expect(approval.getApprovedText('old')).toBe('eski metin')
    expect(approval.getApproved('empty')).toEqual({ blocks: [], text: '' })
  })

  it('onaylanmamış Meeting için hata verir', () => {
    const { approval } = setup()

    expect(() => approval.getApproved('m1')).toThrow('onaylanmamış')
  })
})
