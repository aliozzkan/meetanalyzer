import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AUDIO_FORMAT, BYTES_PER_SECOND } from '../../shared/audio'
import { openDatabase, type Db } from '../db/database'
import { createWavHeader } from '../recordings/wav'
import { createWordAudioReader, playbackWindow } from './word-audio'

describe('playbackWindow', () => {
  it('kelimenin öncesine ve sonrasına pencere ekler', () => {
    expect(playbackWindow(10_000, 10_500, 60_000, 2_000)).toEqual({ startMs: 8_000, endMs: 12_500 })
  })

  it('Recording sınırlarına kırpılır', () => {
    expect(playbackWindow(500, 900, 60_000, 2_000)).toEqual({ startMs: 0, endMs: 2_900 })
    expect(playbackWindow(59_000, 59_900, 60_000, 2_000)).toEqual({
      startMs: 57_000,
      endMs: 60_000
    })
  })

  it('sıfır uzunluklu kelime pencerede kalır', () => {
    expect(playbackWindow(11_630, 11_630, 60_000, 2_000)).toEqual({
      startMs: 9_630,
      endMs: 13_630
    })
  })

  it('kelime kaydın dışına taşıyorsa boş pencere verir', () => {
    expect(playbackWindow(70_000, 70_100, 60_000, 2_000)).toEqual({
      startMs: 60_000,
      endMs: 60_000
    })
  })
})

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const SECONDS = 10

// Örnek i'nin değeri i (mod 30000): dilimin doğru yerden alındığı örneklerden okunur.
function setup(filePath: string | null = 'm1/r1/mic.wav'): {
  db: Db
  recordingsDir: string
  read: ReturnType<typeof createWordAudioReader>
} {
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-wordaudio-'))
  tempDirs.push(recordingsDir)
  mkdirSync(join(recordingsDir, 'm1', 'r1'), { recursive: true })
  const samples = AUDIO_FORMAT.sampleRate * SECONDS
  const pcm = Buffer.alloc(samples * 2)
  for (let i = 0; i < samples; i += 1) pcm.writeInt16LE(i % 30_000, i * 2)
  writeFileSync(
    join(recordingsDir, 'm1', 'r1', 'mic.wav'),
    Buffer.concat([createWavHeader({ ...AUDIO_FORMAT, dataBytes: pcm.length }), pcm])
  )

  const db = openDatabase(':memory:')
  db.prepare(
    "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'transcribed', 1)"
  ).run()
  db.prepare(
    'INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at) VALUES (?, ?, 1, 1, 2)'
  ).run('r1', 'm1')
  db.prepare(
    "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES ('r1', 'mic', ?)"
  ).run(filePath)
  db.prepare(
    'INSERT INTO segments (id, recording_id, seq, start_ms, end_ms) VALUES (?, ?, 1, 0, 10000)'
  ).run('s1', 'r1')
  db.prepare(
    'INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect) VALUES (?, ?, 1, ?, ?, ?, 0.3, 1)'
  ).run('w1', 's1', 'kelime', 5_000, 5_500)
  return { db, recordingsDir, read: createWordAudioReader({ db, recordingsDir, paddingMs: 2_000 }) }
}

describe('createWordAudioReader', () => {
  it('kelimenin ±pencere kadar çevresindeki PCM dilimini verir', () => {
    const { read } = setup()

    const audio = read('w1')

    expect(audio.sampleRate).toBe(AUDIO_FORMAT.sampleRate)
    // 3 sn → 7.5 sn = 4.5 sn
    expect(audio.pcm.byteLength).toBe(BYTES_PER_SECOND * 4.5)
    const firstSample = Buffer.from(audio.pcm).readInt16LE(0)
    expect(firstSample).toBe((AUDIO_FORMAT.sampleRate * 3) % 30_000)
  })

  it('kaydın başında ve sonunda kırpılır', () => {
    const { read, db } = setup()
    db.prepare('UPDATE words SET start_ms = 500, end_ms = 900 WHERE id = ?').run('w1')

    expect(read('w1').pcm.byteLength).toBe(BYTES_PER_SECOND * 2.9)

    db.prepare('UPDATE words SET start_ms = 9_500, end_ms = 9_900 WHERE id = ?').run('w1')
    expect(read('w1').pcm.byteLength).toBe(BYTES_PER_SECOND * 2.5)
  })

  it('olmayan kelime word-not-found verir', () => {
    const { read } = setup()

    expect(() => read('yok')).toThrow(expect.objectContaining({ code: 'word-not-found' }))
    expect(() => read(42 as unknown as string)).toThrow(
      expect.objectContaining({ code: 'invalid-input' })
    )
  })

  it('ses dosyası silinmişse (file_path NULL ya da dosya yok) audio-missing verir', () => {
    const nullPath = setup(null)
    expect(() => nullPath.read('w1')).toThrow(expect.objectContaining({ code: 'audio-missing' }))

    const missing = setup()
    rmSync(join(missing.recordingsDir, 'm1'), { recursive: true })
    expect(() => missing.read('w1')).toThrow(expect.objectContaining({ code: 'audio-missing' }))
  })

  it('recordings klasörü dışına çıkan DB yolunu reddeder ve dosyayı okumaz', () => {
    const outside = mkdtempSync(join(tmpdir(), 'meetanalyzing-outside-'))
    tempDirs.push(outside)
    mkdirSync(join(outside, 'x'), { recursive: true })
    writeFileSync(join(outside, 'x', 'mic.wav'), 'gizli')
    for (const escaped of ['../../etc/passwd', '/etc/passwd', 'm1/mic.wav', '../x/y/mic.wav']) {
      const { read } = setup(escaped)
      expect(() => read('w1')).toThrow(expect.objectContaining({ code: 'audio-missing' }))
    }
  })
})
