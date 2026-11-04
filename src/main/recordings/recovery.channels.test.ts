import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AUDIO_FORMAT, type AudioChannel } from '../../shared/audio'
import { openDatabase, type Db } from '../db/database'
import { recoverInterruptedRecordings } from './recovery'
import { createWavHeader } from './wav'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function setup(): { db: Db; recordingsDir: string } {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-recovery2-'))
  tempDirs.push(recordingsDir)
  db.prepare(
    "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'recording', 1)"
  ).run()
  return { db, recordingsDir }
}

// Çökme anındaki iki kanallı Recording: header'lar dataBytes = 0 ile yazılmıştır, ardından ses gelmiştir.
function interrupted(
  { db, recordingsDir }: { db: Db; recordingsDir: string },
  data: Record<AudioChannel, Buffer | null> // null: dosya hiç oluşmamış
): string {
  const id = 'r1'
  mkdirSync(join(recordingsDir, 'm1', id), { recursive: true })
  db.prepare('INSERT INTO recordings (id, meeting_id, seq, started_at) VALUES (?, ?, 1, 1000)').run(
    id,
    'm1'
  )
  for (const kind of ['mic', 'system'] as const) {
    const relative = join('m1', id, `${kind}.wav`)
    const bytes = data[kind]
    if (bytes !== null) {
      const header = createWavHeader({ ...AUDIO_FORMAT, dataBytes: 0 })
      writeFileSync(join(recordingsDir, relative), Buffer.concat([header, bytes]))
    }
    db.prepare(
      'INSERT INTO recording_channels (recording_id, kind, file_path) VALUES (?, ?, ?)'
    ).run(id, kind, relative)
  }
  return id
}

const TWO_SECONDS = Buffer.alloc(64_000, 7)
const ONE_SECOND = Buffer.alloc(32_000, 7)

describe('recoverInterruptedRecordings: iki kanal', () => {
  it('iki dosyayı ayrı ayrı onarır; ended_at ve Recording süresi kısa kanala göre belirlenir', () => {
    const ctx = setup()
    const id = interrupted(ctx, { mic: TWO_SECONDS, system: ONE_SECOND })

    const result = recoverInterruptedRecordings(ctx)

    expect(result).toEqual({ repaired: 1, discarded: 0, failed: 0 })
    const mic = readFileSync(join(ctx.recordingsDir, 'm1', id, 'mic.wav'))
    const system = readFileSync(join(ctx.recordingsDir, 'm1', id, 'system.wav'))
    expect(mic.readUInt32LE(40)).toBe(64_000)
    expect(system.readUInt32LE(40)).toBe(32_000)
    const row = ctx.db.prepare('SELECT ended_at FROM recordings WHERE id = ?').get(id) as {
      ended_at: number
    }
    expect(row.ended_at).toBe(1_000 + 1_000)
    expect(
      ctx.db.prepare('SELECT kind, duration_ms FROM recording_channels ORDER BY kind').all()
    ).toEqual([
      { kind: 'mic', duration_ms: 2_000 },
      { kind: 'system', duration_ms: 1_000 }
    ])
  })

  it('kanallardan biri boşsa Recording bütün olarak (dosyalar ve satırlar) silinir', () => {
    const ctx = setup()
    const id = interrupted(ctx, { mic: TWO_SECONDS, system: Buffer.alloc(0) })

    const result = recoverInterruptedRecordings(ctx)

    expect(result).toEqual({ repaired: 0, discarded: 1, failed: 0 })
    expect(existsSync(join(ctx.recordingsDir, 'm1', id))).toBe(false)
    expect(ctx.db.prepare('SELECT COUNT(*) FROM recordings').pluck().get()).toBe(0)
    expect(ctx.db.prepare('SELECT COUNT(*) FROM recording_channels').pluck().get()).toBe(0)
  })

  it('kanallardan birinin dosyası hiç yoksa da Recording silinir', () => {
    const ctx = setup()
    const id = interrupted(ctx, { mic: null, system: TWO_SECONDS })

    const result = recoverInterruptedRecordings(ctx)

    expect(result.discarded).toBe(1)
    expect(existsSync(join(ctx.recordingsDir, 'm1', id))).toBe(false)
  })

  it('yarım örnek artığı her dosyada ayrı kesilir', () => {
    const ctx = setup()
    const id = interrupted(ctx, {
      mic: Buffer.concat([ONE_SECOND, Buffer.alloc(1)]),
      system: Buffer.concat([ONE_SECOND, Buffer.alloc(3)])
    })

    recoverInterruptedRecordings(ctx)

    // mic: 1 sn + 1 bayt artık → 1 sn; system: 1 sn + 3 bayt → 1 sn + 1 tam örnek (2 bayt), yalnızca yarım örnek kesilir
    expect(readFileSync(join(ctx.recordingsDir, 'm1', id, 'mic.wav')).length).toBe(44 + 32_000)
    expect(readFileSync(join(ctx.recordingsDir, 'm1', id, 'system.wav')).length).toBe(44 + 32_002)
  })
})
