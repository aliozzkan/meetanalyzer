import { describe, expect, it } from 'vitest'
import { countUncorrected, groupIntoBlocks } from '../../shared/transcript'
import { openDatabase, type Db } from '../db/database'
import { createTranscriptService } from './transcript-service'

interface SeedWord {
  text: string
  startMs: number
  suspect?: boolean
}

// Bir Meeting (Transcribed), bir Recording ve kanallı segmentler kurar.
function setup(): {
  db: Db
  add: (id: string, channel: 'mic' | 'system', words: SeedWord[]) => void
} {
  const db = openDatabase(':memory:')
  db.exec(`
    INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'transcribed', 1);
    INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at, transcribed_at)
      VALUES ('r1', 'm1', 1, 1, 2, 3);
  `)
  let seq = 0
  const add = (id: string, channel: 'mic' | 'system', words: SeedWord[]): void => {
    seq += 1
    db.prepare(
      'INSERT INTO segments (id, recording_id, seq, start_ms, end_ms, channel) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, 'r1', seq, words[0].startMs, words.at(-1)!.startMs + 300, channel)
    words.forEach((word, index) => {
      db.prepare(
        `INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect)
         VALUES (?, ?, ?, ?, ?, ?, 0.9, ?)`
      ).run(
        `${id}-w${index + 1}`,
        id,
        index + 1,
        word.text,
        word.startMs,
        word.startMs + 300,
        word.suspect ? 1 : 0
      )
    })
  }
  return { db, add }
}

const sidesOf = (db: Db): { side: string; text: string }[] =>
  createTranscriptService({ db })
    .get('m1')
    .recordings[0].segments.map((segment) => ({
      side: segment.side,
      text: segment.words.map((word) => word.text).join(' ')
    }))

describe('Transcript: iki kanalın birleşimi', () => {
  it('segmentler başlangıç zamanına göre birleşir ve kanaldan türeyen Side taşır', () => {
    const { db, add } = setup()
    add('s-mic-2', 'mic', [{ text: 'tamam', startMs: 9_000 }])
    add('s-sys-1', 'system', [{ text: 'merhaba', startMs: 1_000 }])
    add('s-mic-1', 'mic', [{ text: 'selam', startMs: 4_000 }])

    expect(sidesOf(db)).toEqual([
      { side: 'others', text: 'merhaba' },
      { side: 'self', text: 'selam' },
      { side: 'self', text: 'tamam' }
    ])
  })

  it('ardışık aynı Side’lı segmentler tek blok olur', () => {
    const { db, add } = setup()
    add('a', 'system', [{ text: 'bir', startMs: 1_000 }])
    add('b', 'system', [{ text: 'iki', startMs: 5_000 }])
    add('c', 'mic', [{ text: 'üç', startMs: 9_000 }])
    add('d', 'system', [{ text: 'dört', startMs: 13_000 }])

    const blocks = groupIntoBlocks(createTranscriptService({ db }).get('m1').recordings[0].segments)

    expect(blocks.map((block) => [block.side, block.segments.length])).toEqual([
      ['others', 2],
      ['self', 1],
      ['others', 1]
    ])
  })

  it('yankı: mic kelimeleri system kanalında aynı yazılışla geçiyorsa Transcript’e girmez; ham words değişmez', () => {
    const { db, add } = setup()
    add('s-sys', 'system', [
      { text: 'Bütçeyi', startMs: 10_000 },
      { text: 'onaylıyoruz.', startMs: 10_500 }
    ])
    add('s-echo', 'mic', [
      { text: 'bütçeyi', startMs: 10_100 },
      { text: 'onaylıyoruz', startMs: 10_650 }
    ])

    expect(sidesOf(db)).toEqual([{ side: 'others', text: 'Bütçeyi onaylıyoruz.' }])
    // Ham Transcription çıktısı yerinde durur.
    expect(db.prepare("SELECT COUNT(*) FROM words WHERE segment_id = 's-echo'").pluck().get()).toBe(
      2
    )
  })

  it('yankı ve gerçek söz aynı mic segmentinde: yalnızca yankı kelimeleri düşer', () => {
    const { db, add } = setup()
    add('s-sys', 'system', [
      { text: 'rapor', startMs: 20_000 },
      { text: 'hazır', startMs: 20_400 }
    ])
    add('s-mic', 'mic', [
      { text: 'rapor', startMs: 20_050 },
      { text: 'hazır', startMs: 20_450 },
      { text: 'katılıyorum', startMs: 21_000 }
    ])

    expect(sidesOf(db)).toEqual([
      { side: 'others', text: 'rapor hazır' },
      { side: 'self', text: 'katılıyorum' }
    ])
  })

  it('tek başına eşleşen ortak kelime yankı sayılmaz: Self’in cümlesi bozulmaz (gerçek kayıttan "Bu benim sesim.")', () => {
    const { db, add } = setup()
    add('s-sys', 'system', [
      { text: 've', startMs: 9_380 },
      { text: 'bu', startMs: 9_520 },
      { text: 'kapsamda', startMs: 9_720 }
    ])
    add('s-mic', 'mic', [
      { text: 'Bu', startMs: 9_500 },
      { text: 'benim', startMs: 9_550 },
      { text: 'sesim.', startMs: 9_600 }
    ])

    expect(sidesOf(db)).toEqual([
      { side: 'others', text: 've bu kapsamda' },
      { side: 'self', text: 'Bu benim sesim.' }
    ])
  })

  it('kulaklıklı kayıt (system kanalı boş): hiçbir mic kelimesi atılmaz', () => {
    const { db, add } = setup()
    add('s-mic', 'mic', [
      { text: 'merhaba', startMs: 1_000 },
      { text: 'dünya', startMs: 1_500 }
    ])

    expect(sidesOf(db)).toEqual([{ side: 'self', text: 'merhaba dünya' }])
  })

  it('yankı sayılan Suspect Word’ler “düzeltilmedi” sayısına girmez', () => {
    const { db, add } = setup()
    add('s-sys', 'system', [
      { text: 'toplantı', startMs: 5_000, suspect: true },
      { text: 'başlıyor', startMs: 5_500 }
    ])
    add('s-mic', 'mic', [
      { text: 'toplantı', startMs: 5_100, suspect: true },
      { text: 'başlıyor', startMs: 5_600 },
      { text: 'çağlar', startMs: 30_000, suspect: true }
    ])

    const transcript = createTranscriptService({ db }).get('m1')

    // system'deki 'toplantı' ve mic'teki 'çağlar' sayılır; mic'teki yankı 'toplantı' sayılmaz.
    expect(countUncorrected(transcript)).toBe(2)
  })

  it('yalnızca mic kanalı olan eski Meeting’ler Self olarak görünür (kanal sütunu varsayılanı)', () => {
    const { db } = setup()
    db.exec(`
      INSERT INTO segments (id, recording_id, seq, start_ms, end_ms) VALUES ('legacy', 'r1', 1, 0, 500);
      INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect)
        VALUES ('legacy-w', 'legacy', 1, 'eski', 0, 400, 0.9, 0);
    `)

    expect(sidesOf(db)).toEqual([{ side: 'self', text: 'eski' }])
  })

  it('yankı baskın mic segmentinde sistem kanalında karşılığı olmayan kelimeler de düşer; Self’in kısa sözü kalır', () => {
    const { db, add } = setup()
    add('s-sys', 'system', [
      { text: 'başlı', startMs: 110 },
      { text: 'olduğundan', startMs: 440 },
      { text: 'yanlış', startMs: 1_240 },
      { text: 'cevaplanması', startMs: 1_640 },
      { text: 'muhtemeldir.', startMs: 2_730 }
    ])
    // Yankılı ses "başlı"yı "uçlu" diye tanıdı; 4 kelime eşleşir, "uçlu" eşleşmez
    add('s-echo', 'mic', [
      { text: 'uçlu', startMs: 30 },
      { text: 'olduğundan', startMs: 370 },
      { text: 'yanlış', startMs: 1_500 },
      { text: 'cevaplanması', startMs: 1_810 },
      { text: 'muhtemeldir.', startMs: 2_590 }
    ])
    add('s-self', 'mic', [
      { text: 'Yapma', startMs: 13_600 },
      { text: 'ya.', startMs: 14_100 }
    ])

    expect(sidesOf(db)).toEqual([
      { side: 'others', text: 'başlı olduğundan yanlış cevaplanması muhtemeldir.' },
      { side: 'self', text: 'Yapma ya.' }
    ])
  })
})
