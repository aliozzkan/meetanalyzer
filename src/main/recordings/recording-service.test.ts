import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../db/database'
import { createRecordingService, type RecordingService } from './recording-service'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function setup(options: { microphone?: 'granted' | 'denied' } = {}): {
  recordings: RecordingService
  db: Db
  recordingsDir: string
  tick: () => void
} {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-rec-'))
  tempDirs.push(recordingsDir)
  let time = 1_000
  const recordings = createRecordingService({
    db,
    recordingsDir,
    requestMicrophoneAccess: async () => options.microphone ?? 'granted',
    now: () => time
  })
  return { recordings, db, recordingsDir, tick: () => (time += 1_000) }
}

function insertMeeting(db: Db, id = 'm1', state = 'recording'): void {
  db.prepare('INSERT INTO meetings (id, language, state, created_at) VALUES (?, ?, ?, 1)').run(
    id,
    'tr',
    state
  )
}

// 1 sn = 16 000 örnek x 2 bayt
const ONE_SECOND = Buffer.alloc(32_000, 1)

describe('Recording servisi', () => {
  it('başlat, ses ekle, durdur: geçerli bir 16 kHz mono WAV dosyası ve DB satırları oluşur', async () => {
    const { recordings, db, recordingsDir, tick } = setup()
    insertMeeting(db)

    const recording = await recordings.start('m1')
    recordings.append(recording.id, ONE_SECOND)
    recordings.append(recording.id, ONE_SECOND)
    tick()
    const stopped = recordings.stop(recording.id)

    const file = join(recordingsDir, 'm1', recording.id, 'mic.wav')
    const wav = readFileSync(file)
    expect(wav.length).toBe(44 + 64_000)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.readUInt32LE(4)).toBe(36 + 64_000)
    expect(wav.readUInt32LE(24)).toBe(16_000) // örnekleme
    expect(wav.readUInt16LE(22)).toBe(1) // mono
    expect(wav.readUInt16LE(34)).toBe(16) // bit
    expect(wav.readUInt32LE(40)).toBe(64_000) // veri boyutu
    expect(wav.subarray(44).equals(Buffer.concat([ONE_SECOND, ONE_SECOND]))).toBe(true)

    expect(stopped).toMatchObject({
      id: recording.id,
      meetingId: 'm1',
      seq: 1,
      startedAt: 1_000,
      endedAt: 2_000,
      durationMs: 2_000
    })
    expect(
      db
        .prepare(
          'SELECT kind, file_path, duration_ms FROM recording_channels WHERE recording_id = ?'
        )
        .all(recording.id)
    ).toEqual([{ kind: 'mic', file_path: `m1/${recording.id}/mic.wav`, duration_ms: 2_000 }])
    expect(existsSync(file)).toBe(true)
  })

  it('mikrofon izni reddedilirse Recording başlamaz; satır ve klasör oluşmaz', async () => {
    const { recordings, db, recordingsDir } = setup({ microphone: 'denied' })
    insertMeeting(db)

    await expect(recordings.start('m1')).rejects.toMatchObject({ code: 'microphone-denied' })

    expect(db.prepare('SELECT 1 FROM recordings').all()).toEqual([])
    expect(existsSync(join(recordingsDir, 'm1'))).toBe(false)
  })

  it("recording durumunda olmayan ya da olmayan Meeting'e Recording başlamaz", async () => {
    const { recordings, db, recordingsDir } = setup()
    insertMeeting(db, 'closed-meeting', 'closed')

    await expect(recordings.start('closed-meeting')).rejects.toMatchObject({
      code: 'meeting-not-recording'
    })
    await expect(recordings.start('yok')).rejects.toMatchObject({
      code: 'meeting-not-recording'
    })
    expect(db.prepare('SELECT 1 FROM recordings').all()).toEqual([])
    expect(existsSync(join(recordingsDir, 'closed-meeting'))).toBe(false)
  })

  it('aynı Meeting için aktif Recording varken ikincisi başlamaz, durdurulunca başlar', async () => {
    const { recordings, db } = setup()
    insertMeeting(db)
    const first = await recordings.start('m1')

    await expect(recordings.start('m1')).rejects.toMatchObject({
      code: 'recording-already-active'
    })

    recordings.stop(first.id)
    await expect(recordings.start('m1')).resolves.toMatchObject({ seq: 2 })
  })

  it('aynı Meeting içinde üç Recording ayrı dosyalara yazılır', async () => {
    const { recordings, db, recordingsDir } = setup()
    insertMeeting(db)

    const files: Buffer[] = []
    for (const fill of [1, 2, 3]) {
      const recording = await recordings.start('m1')
      recordings.append(recording.id, Buffer.alloc(100, fill))
      recordings.stop(recording.id)
      files.push(readFileSync(join(recordingsDir, 'm1', recording.id, 'mic.wav')))
    }

    expect(files.map((wav) => wav.subarray(44)[0])).toEqual([1, 2, 3])
    expect(files.every((wav) => wav.length === 44 + 100)).toBe(true)
    expect(db.prepare('SELECT seq FROM recordings ORDER BY seq').pluck().all()).toEqual([1, 2, 3])
    expect(db.prepare('SELECT DISTINCT file_path FROM recording_channels').all()).toHaveLength(3)
  })

  it('bilinmeyen ya da durdurulmuş Recording için ses eklenemez ve durdurulamaz', async () => {
    const { recordings, db } = setup()
    insertMeeting(db)
    const recording = await recordings.start('m1')
    recordings.stop(recording.id)

    expect(() => recordings.append(recording.id, ONE_SECOND)).toThrow(
      expect.objectContaining({ code: 'unknown-recording' })
    )
    expect(() => recordings.stop(recording.id)).toThrow(
      expect.objectContaining({ code: 'unknown-recording' })
    )
    expect(() => recordings.append('yok', ONE_SECOND)).toThrow(
      expect.objectContaining({ code: 'unknown-recording' })
    )
  })

  it("abortMeeting aktif Recording'i kapatır; sonrasında ses eklenemez", async () => {
    const { recordings, db } = setup()
    insertMeeting(db, 'm1')
    const aborted = await recordings.start('m1')
    expect(recordings.hasActive('m1')).toBe(true)

    recordings.abortMeeting('m1')

    expect(recordings.hasActive('m1')).toBe(false)
    expect(() => recordings.append(aborted.id, ONE_SECOND)).toThrow(
      expect.objectContaining({ code: 'unknown-recording' })
    )
  })

  it('abortMeeting yalnızca o Meeting’in Recording’ini kapatır', async () => {
    const { recordings, db } = setup()
    insertMeeting(db, 'm1', 'closed')
    insertMeeting(db, 'm2')
    const other = await recordings.start('m2')

    recordings.abortMeeting('m1')

    expect(recordings.hasActive('m2')).toBe(true)
    expect(() => recordings.append(other.id, ONE_SECOND)).not.toThrow()
  })

  it('discard Recording satırını, dosyasını ve klasörünü tamamen kaldırır', async () => {
    const { recordings, db, recordingsDir } = setup()
    insertMeeting(db)
    const recording = await recordings.start('m1')
    recordings.append(recording.id, ONE_SECOND)

    recordings.discard(recording.id)

    expect(db.prepare('SELECT 1 FROM recordings').all()).toEqual([])
    expect(db.prepare('SELECT 1 FROM recording_channels').all()).toEqual([])
    expect(existsSync(join(recordingsDir, 'm1', recording.id))).toBe(false)
    expect(recordings.hasActive('m1')).toBe(false)
    expect(() => recordings.append(recording.id, ONE_SECOND)).toThrow(
      expect.objectContaining({ code: 'unknown-recording' })
    )
  })

  it("stopAll aktif Recording'i düzgünce bitirir: geçerli header ve ended_at yazılır", async () => {
    const { recordings, db, recordingsDir, tick } = setup()
    insertMeeting(db)
    const recording = await recordings.start('m1')
    recordings.append(recording.id, ONE_SECOND)
    tick()

    recordings.stopAll()

    const wav = readFileSync(join(recordingsDir, 'm1', recording.id, 'mic.wav'))
    expect(wav.readUInt32LE(40)).toBe(32_000)
    expect(
      db.prepare('SELECT ended_at FROM recordings WHERE id = ?').pluck().get(recording.id)
    ).toBe(2_000)
    expect(recordings.hasActive('m1')).toBe(false)
  })

  it('tek sayıda bayt ya da aşırı büyük parça reddedilir ve dosyaya yazılmaz', async () => {
    const { recordings, db, recordingsDir } = setup()
    insertMeeting(db)
    const recording = await recordings.start('m1')

    expect(() => recordings.append(recording.id, Buffer.alloc(101))).toThrow(
      expect.objectContaining({ code: 'invalid-chunk' })
    )
    // Üst sınır, 5 sn'lik parça süresinin iki katıdır: 2 x 5 sn x 32 000 bayt/sn
    expect(() => recordings.append(recording.id, Buffer.alloc(320_002))).toThrow(
      expect.objectContaining({ code: 'invalid-chunk' })
    )
    recordings.append(recording.id, Buffer.alloc(320_000))
    recordings.stop(recording.id)

    const wav = readFileSync(join(recordingsDir, 'm1', recording.id, 'mic.wav'))
    expect(wav.length).toBe(44 + 320_000)
  })
})
