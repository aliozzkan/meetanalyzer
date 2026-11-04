import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../db/database'
import { createRecordingService, RecordingError, type RecordingService } from './recording-service'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function setup(): { recordings: RecordingService; db: Db; recordingsDir: string } {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-channels-'))
  tempDirs.push(recordingsDir)
  db.prepare(
    "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'recording', 1)"
  ).run()
  let time = 1_000
  const recordings = createRecordingService({
    db,
    recordingsDir,
    requestMicrophoneAccess: async () => 'granted',
    hasSystemAudioConsent: () => true,
    power: { acquire: () => {}, release: () => {} },
    now: () => (time += 500)
  })
  return { recordings, db, recordingsDir }
}

const ONE_SECOND = Buffer.alloc(32_000, 1)
const HALF_SECOND = Buffer.alloc(16_000, 2)

describe('Recording servisi: iki kanal', () => {
  it('start: mic.wav ve system.wav birlikte açılır, iki kanal satırı yazılır', async () => {
    const { recordings, db, recordingsDir } = setup()

    const recording = await recordings.start('m1')

    for (const name of ['mic.wav', 'system.wav']) {
      expect(existsSync(join(recordingsDir, 'm1', recording.id, name))).toBe(true)
    }
    const channels = db
      .prepare(
        'SELECT kind, file_path FROM recording_channels WHERE recording_id = ? ORDER BY kind'
      )
      .all(recording.id)
    expect(channels).toEqual([
      { kind: 'mic', file_path: join('m1', recording.id, 'mic.wav') },
      { kind: 'system', file_path: join('m1', recording.id, 'system.wav') }
    ])
  })

  it('parçalar kendi kanalının dosyasına yazılır; stop iki header’ı ve kanal sürelerini yazar', async () => {
    const { recordings, db, recordingsDir } = setup()
    const recording = await recordings.start('m1')

    recordings.append(recording.id, ONE_SECOND, 'mic')
    recordings.append(recording.id, ONE_SECOND, 'mic')
    recordings.append(recording.id, HALF_SECOND, 'system')
    const stopped = recordings.stop(recording.id)

    const mic = readFileSync(join(recordingsDir, 'm1', recording.id, 'mic.wav'))
    const system = readFileSync(join(recordingsDir, 'm1', recording.id, 'system.wav'))
    expect(mic.readUInt32LE(40)).toBe(64_000)
    expect(system.readUInt32LE(40)).toBe(16_000)
    expect(mic.readUInt32LE(24)).toBe(16_000)
    expect(system.readUInt32LE(24)).toBe(16_000)
    expect(system.subarray(44).equals(HALF_SECOND)).toBe(true)

    const durations = db
      .prepare(
        'SELECT kind, duration_ms FROM recording_channels WHERE recording_id = ? ORDER BY kind'
      )
      .all(recording.id)
    expect(durations).toEqual([
      { kind: 'mic', duration_ms: 2_000 },
      { kind: 'system', duration_ms: 500 }
    ])
    expect(stopped.durationMs).toBe(2_000)
    expect(stopped.endedAt).not.toBeNull()
  })

  it('kanal verilmezse parça mikrofona yazılır; bilinmeyen kanal reddedilir', async () => {
    const { recordings, recordingsDir } = setup()
    const recording = await recordings.start('m1')

    recordings.append(recording.id, ONE_SECOND)
    expect(() =>
      recordings.append(recording.id, ONE_SECOND, 'speaker' as unknown as 'mic')
    ).toThrow(RecordingError)
    recordings.stop(recording.id)

    const mic = readFileSync(join(recordingsDir, 'm1', recording.id, 'mic.wav'))
    expect(mic.readUInt32LE(40)).toBe(32_000)
  })

  it('discard: iki dosyayı, klasörü ve satırları siler (kaynak açılamadı)', async () => {
    const { recordings, db, recordingsDir } = setup()
    const recording = await recordings.start('m1')

    recordings.discard(recording.id)

    expect(existsSync(join(recordingsDir, 'm1', recording.id))).toBe(false)
    expect(db.prepare('SELECT COUNT(*) FROM recordings').pluck().get()).toBe(0)
    expect(db.prepare('SELECT COUNT(*) FROM recording_channels').pluck().get()).toBe(0)
  })

  it('kayıt sırasında kaynak kopması: stop kaydedilen kısmı korur', async () => {
    const { recordings, db } = setup()
    const recording = await recordings.start('m1')
    recordings.append(recording.id, ONE_SECOND, 'mic')
    recordings.append(recording.id, ONE_SECOND, 'system')

    recordings.stop(recording.id)

    const row = db
      .prepare(
        'SELECT ended_at, (SELECT MIN(duration_ms) FROM recording_channels WHERE recording_id = ?) AS min_ms FROM recordings WHERE id = ?'
      )
      .get(recording.id, recording.id) as { ended_at: number; min_ms: number }
    expect(row.ended_at).not.toBeNull()
    expect(row.min_ms).toBe(1_000)
  })
})

describe('Recording servisi: sistem sesi bilgilendirmesi', () => {
  function setupWithConsent(consent: { given: boolean }): {
    recordings: RecordingService
    db: Db
    recordingsDir: string
  } {
    const db = openDatabase(':memory:')
    const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-consent-'))
    tempDirs.push(recordingsDir)
    db.prepare(
      "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'recording', 1)"
    ).run()
    const recordings = createRecordingService({
      db,
      recordingsDir,
      requestMicrophoneAccess: async () => 'granted',
      hasSystemAudioConsent: () => consent.given,
      power: { acquire: () => {}, release: () => {} }
    })
    return { recordings, db, recordingsDir }
  }

  it('bilgilendirme kabul edilmeden Recording başlamaz: satır ve dosya oluşmaz', async () => {
    const { recordings, db, recordingsDir } = setupWithConsent({ given: false })

    await expect(recordings.start('m1')).rejects.toMatchObject({
      code: 'system-audio-consent-required'
    })

    expect(db.prepare('SELECT COUNT(*) FROM recordings').pluck().get()).toBe(0)
    expect(existsSync(join(recordingsDir, 'm1'))).toBe(false)
  })

  it('kabulden sonra aynı servis Recording başlatır (kabul her başlatmada yeniden okunur)', async () => {
    const consent = { given: false }
    const { recordings } = setupWithConsent(consent)
    await expect(recordings.start('m1')).rejects.toBeInstanceOf(RecordingError)

    consent.given = true

    await expect(recordings.start('m1')).resolves.toMatchObject({ meetingId: 'm1', seq: 1 })
  })
})
