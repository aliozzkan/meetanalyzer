import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AUDIO_FORMAT } from '../../shared/audio'
import { openDatabase, type Db } from '../db/database'
import { recoverInterruptedRecordings } from './recovery'
import { createWavHeader } from './wav'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function setup(): { db: Db; recordingsDir: string } {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-recovery-'))
  tempDirs.push(recordingsDir)
  db.prepare(
    "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'recording', 1)"
  ).run()
  return { db, recordingsDir }
}

// Çökme anındaki dosya: header dataBytes = 0 ile yazılmıştır, ardından ses gelmiştir.
function interruptedRecording(
  { db, recordingsDir }: { db: Db; recordingsDir: string },
  options: {
    id?: string
    startedAt?: number
    data?: Buffer | null // null: dosya hiç oluşmamış
    rawFile?: Buffer // verilirse dosya tam olarak bu baytlarla yazılır (ör. yarım kalmış header)
    endedAt?: number | null
  } = {}
): { id: string; file: string } {
  const { id = 'r1', startedAt = 1_000, data = Buffer.alloc(0), rawFile, endedAt = null } = options
  const relative = join('m1', id, 'mic.wav')
  const file = join(recordingsDir, relative)
  if (data !== null) {
    mkdirSync(join(recordingsDir, 'm1', id), { recursive: true })
    const header = createWavHeader({ ...AUDIO_FORMAT, dataBytes: 0 })
    writeFileSync(file, rawFile ?? Buffer.concat([header, data]))
  }
  const seq = db.prepare('SELECT COUNT(*) + 1 FROM recordings').pluck().get() as number
  db.prepare(
    'INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, 'm1', seq, startedAt, endedAt)
  db.prepare(
    "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES (?, 'mic', ?)"
  ).run(id, relative)
  return { id, file }
}

// 1 sn = 16 000 örnek x 2 bayt
const TWO_SECONDS = Buffer.alloc(64_000, 7)

describe('recoverInterruptedRecordings', () => {
  it('yarım kalmış kaydın header’ını gerçek boyutla onarır ve süreyi yazar', () => {
    const ctx = setup()
    const { id, file } = interruptedRecording(ctx, { startedAt: 1_000, data: TWO_SECONDS })

    const result = recoverInterruptedRecordings(ctx)

    const wav = readFileSync(file)
    expect(wav.readUInt32LE(40)).toBe(64_000) // data boyutu
    expect(wav.readUInt32LE(4)).toBe(36 + 64_000) // RIFF boyutu
    expect(wav.subarray(44).equals(TWO_SECONDS)).toBe(true)
    expect(ctx.db.prepare('SELECT ended_at FROM recordings WHERE id = ?').pluck().get(id)).toBe(
      3_000
    ) // started_at + 2000 ms
    expect(
      ctx.db
        .prepare('SELECT duration_ms FROM recording_channels WHERE recording_id = ?')
        .pluck()
        .get(id)
    ).toBe(2_000)
    expect(result).toEqual({ repaired: 1, discarded: 0, failed: 0 })
  })

  it('çökme bir örneğin ortasında olduysa yarım örneği keser; kalan ses geçerli kalır', () => {
    const ctx = setup()
    const withHalfSample = Buffer.concat([TWO_SECONDS, Buffer.from([9])]) // 64 001 bayt
    const { id, file } = interruptedRecording(ctx, { data: withHalfSample })

    recoverInterruptedRecordings(ctx)

    const wav = readFileSync(file)
    expect(wav.length).toBe(44 + 64_000)
    expect(wav.readUInt32LE(40)).toBe(64_000)
    expect(wav.readUInt32LE(4)).toBe(36 + 64_000)
    expect(
      ctx.db
        .prepare('SELECT duration_ms FROM recording_channels WHERE recording_id = ?')
        .pluck()
        .get(id)
    ).toBe(2_000)
  })

  it('ses içermeyen Recording tamamen silinir; Meeting kalır', () => {
    const ctx = setup()
    const headerOnly = interruptedRecording(ctx, { id: 'header-only' })
    const brokenHeader = interruptedRecording(ctx, {
      id: 'broken-header',
      rawFile: Buffer.alloc(10)
    })
    interruptedRecording(ctx, { id: 'missing-file', data: null })

    const result = recoverInterruptedRecordings(ctx)

    expect(result).toEqual({ repaired: 0, discarded: 3, failed: 0 })
    expect(ctx.db.prepare('SELECT 1 FROM recordings').all()).toEqual([])
    expect(ctx.db.prepare('SELECT 1 FROM recording_channels').all()).toEqual([])
    expect(existsSync(headerOnly.file)).toBe(false)
    expect(existsSync(join(ctx.recordingsDir, 'm1', 'header-only'))).toBe(false)
    expect(existsSync(brokenHeader.file)).toBe(false)
    expect(ctx.db.prepare("SELECT state FROM meetings WHERE id = 'm1'").pluck().get()).toBe(
      'recording'
    )
  })

  it('ended_at dolu (düzgün bitmiş) Recording’e dokunmaz', () => {
    const ctx = setup()
    const { id, file } = interruptedRecording(ctx, { data: TWO_SECONDS, endedAt: 9_999 })
    const before = readFileSync(file)

    const result = recoverInterruptedRecordings(ctx)

    expect(result).toEqual({ repaired: 0, discarded: 0, failed: 0 })
    expect(readFileSync(file).equals(before)).toBe(true)
    expect(ctx.db.prepare('SELECT ended_at FROM recordings WHERE id = ?').pluck().get(id)).toBe(
      9_999
    )
  })

  it('ikinci kez çalıştırmak güvenlidir: hiçbir şey yapmaz', () => {
    const ctx = setup()
    const { file } = interruptedRecording(ctx, { data: TWO_SECONDS })
    recoverInterruptedRecordings(ctx)
    const afterFirst = readFileSync(file)

    const second = recoverInterruptedRecordings(ctx)

    expect(second).toEqual({ repaired: 0, discarded: 0, failed: 0 })
    expect(readFileSync(file).equals(afterFirst)).toBe(true)
  })

  it('kayıt klasörünün dışına işaret eden yola dokunmaz; dış dosya değişmez', () => {
    const ctx = setup()
    // Kayıt klasörü altklasor; DB'deki yol onun dışındaki (kardeş) gerçek bir dosyayı gösteriyor.
    const outsideFile = join(ctx.recordingsDir, 'disari', 'mic.wav')
    mkdirSync(join(ctx.recordingsDir, 'disari'))
    writeFileSync(
      outsideFile,
      Buffer.concat([createWavHeader({ ...AUDIO_FORMAT, dataBytes: 0 }), TWO_SECONDS])
    )
    const before = readFileSync(outsideFile)
    ctx.db
      .prepare(
        "INSERT INTO recordings (id, meeting_id, seq, started_at) VALUES ('evil', 'm1', 1, 1)"
      )
      .run()
    ctx.db
      .prepare(
        "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES ('evil', 'mic', '../disari/mic.wav')"
      )
      .run()
    const recordingsDir = join(ctx.recordingsDir, 'altklasor')
    mkdirSync(recordingsDir)

    const result = recoverInterruptedRecordings({ db: ctx.db, recordingsDir })

    expect(result).toEqual({ repaired: 0, discarded: 0, failed: 1 })
    expect(readFileSync(outsideFile).equals(before)).toBe(true)
    expect(ctx.db.prepare("SELECT 1 FROM recordings WHERE id = 'evil'").get()).toBeDefined()
  })

  it('kayıt klasörünün kökündeki tek segmentli yol tüm kayıtları silmez', () => {
    const ctx = setup()
    const healthy = interruptedRecording(ctx, { id: 'saglam', data: TWO_SECONDS })
    ctx.db
      .prepare(
        "INSERT INTO recordings (id, meeting_id, seq, started_at) VALUES ('bozuk', 'm1', 2, 1)"
      )
      .run()
    ctx.db
      .prepare(
        "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES ('bozuk', 'mic', 'mic.wav')"
      )
      .run()

    const result = recoverInterruptedRecordings(ctx)

    expect(existsSync(healthy.file)).toBe(true) // kayıt klasörü silinmedi
    expect(result).toEqual({ repaired: 1, discarded: 0, failed: 1 })
    expect(existsSync(ctx.recordingsDir)).toBe(true)
  })

  it('bir satır işlenemese de diğer Recording’ler onarılmaya devam eder', () => {
    const ctx = setup()
    // mic.wav bir dosya değil klasör: açılırken hata verir
    mkdirSync(join(ctx.recordingsDir, 'm1', 'bozuk', 'mic.wav'), { recursive: true })
    ctx.db
      .prepare(
        "INSERT INTO recordings (id, meeting_id, seq, started_at) VALUES ('bozuk', 'm1', 1, 1)"
      )
      .run()
    ctx.db
      .prepare(
        "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES ('bozuk', 'mic', 'm1/bozuk/mic.wav')"
      )
      .run()
    const healthy = interruptedRecording(ctx, { id: 'saglam', data: TWO_SECONDS })

    const result = recoverInterruptedRecordings(ctx)

    expect(result).toEqual({ repaired: 1, discarded: 0, failed: 1 })
    expect(readFileSync(healthy.file).readUInt32LE(40)).toBe(64_000)
  })
})
