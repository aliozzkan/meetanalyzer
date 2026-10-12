import { describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../db/database'
import { createTranscriptService, type TranscriptService } from './transcript-service'

function setup(state = 'transcribed'): {
  db: Db
  transcripts: TranscriptService
} {
  const db = openDatabase(':memory:')
  db.prepare(
    "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'en', ?, 1)"
  ).run(state)
  // Recording 2 önce eklendi: sıralama seq'e göre olmalı.
  for (const seq of [2, 1]) {
    db.prepare(
      'INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at, transcribed_at) VALUES (?, ?, ?, 1, 2, 3)'
    ).run(`r${seq}`, 'm1', seq)
    db.prepare(
      'INSERT INTO segments (id, recording_id, seq, start_ms, end_ms) VALUES (?, ?, 1, 0, 1000)'
    ).run(`s${seq}`, `r${seq}`)
    ;[
      ['Hello', 0],
      ['wrold', 1],
      ['again', 0]
    ].forEach(([text, suspect], index) => {
      db.prepare(
        'INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect) VALUES (?, ?, ?, ?, 0, 1, 0.9, ?)'
      ).run(`w${seq}-${index + 1}`, `s${seq}`, index + 1, text, suspect)
    })
  }
  return { db, transcripts: createTranscriptService({ db, now: () => 42 }) }
}

describe('Transcript servisi', () => {
  it('Transcript Recording ve kelime sırasıyla gelir, Correction yoksa null', () => {
    const { transcripts } = setup()

    const transcript = transcripts.get('m1')

    expect(transcript.recordings.map((recording) => recording.id)).toEqual(['r1', 'r2'])
    expect(transcript.recordings[0].segments[0].words).toEqual([
      { id: 'w1-1', text: 'Hello', isSuspect: false, corrected: null },
      { id: 'w1-2', text: 'wrold', isSuspect: true, corrected: null },
      { id: 'w1-3', text: 'again', isSuspect: false, corrected: null }
    ])
  })

  it('Correction kaydedilir, upsert olur ve Transcript onu gösterir', () => {
    const { transcripts, db } = setup()

    transcripts.correct('w1-2', 'wor ld')
    transcripts.correct('w1-2', 'world')

    expect(db.prepare('SELECT * FROM corrections').all()).toEqual([
      { word_id: 'w1-2', original: 'wrold', corrected: 'world', language: 'en', created_at: 42 }
    ])
    expect(transcripts.get('m1').recordings[0].segments[0].words[1].corrected).toBe('world')
  })

  it('boş ve çok kelimeli Correction olduğu gibi saklanır (kenar boşlukları kırpılır)', () => {
    const { transcripts } = setup()

    transcripts.correct('w1-2', '   ')
    expect(transcripts.get('m1').recordings[0].segments[0].words[1].corrected).toBe('')

    transcripts.correct('w1-2', '  big  new world ')
    expect(transcripts.get('m1').recordings[0].segments[0].words[1].corrected).toBe(
      'big  new world'
    )
  })

  it('Correction geri alınabilir', () => {
    const { transcripts } = setup()
    transcripts.correct('w1-2', 'world')

    transcripts.revert('w1-2')

    expect(transcripts.get('m1').recordings[0].segments[0].words[1].corrected).toBeNull()
  })

  it('Suspect olmayan kelimeye Correction yazılamaz', () => {
    const { transcripts, db } = setup()

    expect(() => transcripts.correct('w1-1', 'x')).toThrow(
      expect.objectContaining({ code: 'not-suspect' })
    )
    expect(db.prepare('SELECT COUNT(*) AS n FROM corrections').get()).toEqual({ n: 0 })
  })

  it('olmayan kelime ve geçersiz girdi reddedilir', () => {
    const { transcripts } = setup()

    expect(() => transcripts.correct('yok', 'x')).toThrow(
      expect.objectContaining({ code: 'word-not-found' })
    )
    expect(() => transcripts.correct('w1-2', 42 as unknown as string)).toThrow(
      expect.objectContaining({ code: 'invalid-input' })
    )
  })

  it('Meeting Transcribed değilse Correction yazılamaz ya da geri alınamaz', () => {
    const { transcripts, db } = setup('approved')

    expect(() => transcripts.correct('w1-2', 'x')).toThrow(
      expect.objectContaining({ code: 'not-correctable' })
    )
    db.prepare("INSERT INTO corrections VALUES ('w1-2', 'wrold', 'x', 'en', 1)").run()
    expect(() => transcripts.revert('w1-2')).toThrow(
      expect.objectContaining({ code: 'not-correctable' })
    )
  })

  it('Transcript yalnızca Transcribed ve Approved Meeting için okunur', () => {
    const { transcripts } = setup('closed')

    expect(() => transcripts.get('m1')).toThrow(
      expect.objectContaining({ code: 'not-transcribed' })
    )
    expect(() => transcripts.get('yok')).toThrow(
      expect.objectContaining({ code: 'meeting-not-found' })
    )
  })
})
