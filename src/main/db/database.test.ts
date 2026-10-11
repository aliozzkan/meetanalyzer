import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from './database'

function insertMeeting(
  db: Db,
  {
    id = 'm1',
    language = 'tr',
    state = 'recording'
  }: Partial<Record<'id' | 'language' | 'state', string>> = {}
): void {
  db.prepare('INSERT INTO meetings (id, language, state, created_at) VALUES (?, ?, ?, 1)').run(
    id,
    language,
    state
  )
}

describe('openDatabase', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'meetanalyzing-db-'))
    tempDirs.push(dir)
    return join(dir, 'test.db')
  }

  it('boş bir veritabanında Meeting eklenebilir', () => {
    const db = openDatabase(':memory:')

    insertMeeting(db)

    expect(db.prepare('SELECT id, state FROM meetings').all()).toEqual([
      { id: 'm1', state: 'recording' }
    ])
  })

  it('aynı dosya yeniden açıldığında migration tekrar çalışmaz ve veri korunur', () => {
    const path = tempDbPath()
    const first = openDatabase(path)
    insertMeeting(first, { state: 'closed' })
    first.close()

    const second = openDatabase(path)

    expect(second.prepare('SELECT id FROM meetings').all()).toEqual([{ id: 'm1' }])
    second.close()
  })

  it('geçersiz bir Meeting durumu reddedilir', () => {
    const db = openDatabase(':memory:')

    expect(() => insertMeeting(db, { state: 'finished' })).toThrow(/CHECK constraint failed/)
  })

  it("Meeting silinince Recording'leri de silinir", () => {
    const db = openDatabase(':memory:')
    insertMeeting(db, { state: 'closed' })
    db.prepare(
      "INSERT INTO recordings (id, meeting_id, seq, started_at) VALUES ('r1', 'm1', 1, 1)"
    ).run()

    db.prepare("DELETE FROM meetings WHERE id = 'm1'").run()

    expect(db.prepare('SELECT id FROM recordings').all()).toEqual([])
  })

  it("Meeting silinince Transcript kelimeleri, Correction'ları, Approved Transcript'i ve Transcription Queue kaydı da silinir", () => {
    const db = openDatabase(':memory:')
    insertMeeting(db, { state: 'transcribed' })
    db.exec(`
      INSERT INTO recordings (id, meeting_id, seq, started_at) VALUES ('r1', 'm1', 1, 1);
      INSERT INTO recording_channels (recording_id, kind, file_path) VALUES ('r1', 'mic', '/x/mic.wav');
      INSERT INTO segments (id, recording_id, seq, start_ms, end_ms) VALUES ('s1', 'r1', 1, 0, 1000);
      INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect)
        VALUES ('w1', 's1', 1, 'merhaba', 0, 500, 0.3, 1);
      INSERT INTO corrections (word_id, original, corrected, language, created_at)
        VALUES ('w1', 'merhaba', 'merhabalar', 'tr', 2);
      INSERT INTO approved_transcripts (meeting_id, text, created_at) VALUES ('m1', 'merhabalar', 3);
      INSERT INTO transcription_queue (meeting_id, enqueued_at) VALUES ('m1', 4);
    `)

    db.prepare("DELETE FROM meetings WHERE id = 'm1'").run()

    const remaining = [
      'recordings',
      'recording_channels',
      'segments',
      'words',
      'corrections',
      'approved_transcripts',
      'transcription_queue'
    ].filter((table) => db.prepare(`SELECT 1 FROM ${table}`).get() !== undefined)
    expect(remaining).toEqual([])
  })

  it('desteklenmeyen bir Language reddedilir', () => {
    const db = openDatabase(':memory:')

    expect(() => insertMeeting(db, { language: 'de' })).toThrow(/CHECK constraint failed/)
  })
})
