import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../db/database'
import { transcribeRecording, type TranscribeRecordingOptions } from './transcribe-recording'
import type { RunWhisperOptions, WhisperRun } from './whisper-runner'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function fixtureRun(name: string): WhisperRun {
  const read = (file: string): string =>
    readFileSync(fileURLToPath(new URL(`./fixtures/${file}`, import.meta.url)), 'utf8')
  return { json: JSON.parse(read(`${name}.json`)), stderr: read(`${name}.stderr.txt`) }
}

interface Setup {
  db: Db
  options: TranscribeRecordingOptions
  calls: RunWhisperOptions[]
  progress: number[]
}

// `channels`: Recording'in kanalları ve ses dosyasının veri bayt sayısı (header hariç); 0 = boş kanal.
function setup(
  channels: Partial<Record<'mic' | 'system', number>>,
  run: (options: RunWhisperOptions) => Promise<WhisperRun>
): Setup {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-transcribe2-'))
  tempDirs.push(recordingsDir)
  db.prepare(
    "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'closed', 1)"
  ).run()
  db.prepare(
    'INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at) VALUES (?, ?, 1, 1, 2)'
  ).run('r1', 'm1')
  mkdirSync(join(recordingsDir, 'm1', 'r1'), { recursive: true })
  for (const [kind, dataBytes] of Object.entries(channels)) {
    db.prepare(
      'INSERT INTO recording_channels (recording_id, kind, file_path) VALUES (?, ?, ?)'
    ).run('r1', kind, `m1/r1/${kind}.wav`)
    writeFileSync(join(recordingsDir, 'm1', 'r1', `${kind}.wav`), Buffer.alloc(44 + dataBytes))
  }

  const calls: RunWhisperOptions[] = []
  const progress: number[] = []
  return {
    db,
    calls,
    progress,
    options: {
      db,
      recordingsDir,
      recordingId: 'r1',
      language: 'tr',
      suspectThreshold: 0.5,
      whisper: { cliPath: '/cli', modelPath: '/model', vadModelPath: '/vad', threads: 3, nice: 10 },
      onProgress: (percent) => progress.push(percent),
      now: () => 5_000,
      run: (runOptions) => {
        calls.push(runOptions)
        return run(runOptions)
      }
    }
  }
}

const channelRows = (db: Db): { kind: string; transcribed_at: number | null }[] =>
  db.prepare('SELECT kind, transcribed_at FROM recording_channels ORDER BY kind').all() as {
    kind: string
    transcribed_at: number | null
  }[]
const recordingDone = (db: Db): number | null =>
  db.prepare("SELECT transcribed_at FROM recordings WHERE id = 'r1'").pluck().get() as number | null

describe('transcribeRecording: kanal başına', () => {
  it('iki kanallı Recording için iki whisper çağrısı yapılır; segmentler kanallarıyla yazılır', async () => {
    const { db, options, calls } = setup({ mic: 3200, system: 3200 }, async () =>
      fixtureRun('tr-tiny')
    )

    const result = await transcribeRecording(options)

    expect(calls.map((call) => call.wavPath.split('/').pop())).toEqual(['mic.wav', 'system.wav'])
    expect(result).toEqual({ segments: 4, words: 32, suspects: 16 })
    const segments = db.prepare('SELECT seq, channel FROM segments ORDER BY seq').all() as {
      seq: number
      channel: string
    }[]
    // Segment numaraları Recording içinde sürer; her kanalın segmentleri kendi kanalıyla işaretlidir.
    expect(segments).toEqual([
      { seq: 1, channel: 'mic' },
      { seq: 2, channel: 'mic' },
      { seq: 3, channel: 'system' },
      { seq: 4, channel: 'system' }
    ])
    expect(channelRows(db)).toEqual([
      { kind: 'mic', transcribed_at: 5_000 },
      { kind: 'system', transcribed_at: 5_000 }
    ])
    expect(recordingDone(db)).toBe(5_000)
  })

  it('Recording yalnızca tüm kanallar bitince işlenmiş sayılır; ilerleme kanal sayısına göre bölünür', async () => {
    const { db, options, progress } = setup({ mic: 3200, system: 3200 }, async (runOptions) => {
      runOptions.onProgress?.(50)
      // Birinci kanal bitmiş, ikincisi sürerken Recording henüz işlenmiş değildir.
      if (runOptions.wavPath.endsWith('system.wav')) expect(recordingDone(db)).toBeNull()
      return fixtureRun('tr-tiny')
    })

    await transcribeRecording(options)

    // Her kanal whisper'ın bildirdiği %50'yi iletir: birinci kanalın yarısı = %25, ikincinin yarısı = %75.
    expect(progress).toEqual([25, 75])
  })

  it('ikinci kanalda hata olursa birinci kanalın sonucu korunur; yeniden başlatmada yalnızca kalan kanal işlenir', async () => {
    let failSystem = true
    const { db, options, calls } = setup({ mic: 3200, system: 3200 }, async (runOptions) => {
      if (failSystem && runOptions.wavPath.endsWith('system.wav')) throw new Error('whisper çöktü')
      return fixtureRun('tr-tiny')
    })

    await expect(transcribeRecording(options)).rejects.toThrow('whisper çöktü')
    expect(channelRows(options.db)).toEqual([
      { kind: 'mic', transcribed_at: 5_000 },
      { kind: 'system', transcribed_at: null }
    ])
    expect(recordingDone(db)).toBeNull()
    expect(db.prepare('SELECT COUNT(*) FROM segments').pluck().get()).toBe(2)

    failSystem = false
    calls.length = 0
    await transcribeRecording(options)

    expect(calls.map((call) => call.wavPath.split('/').pop())).toEqual(['system.wav'])
    expect(db.prepare('SELECT COUNT(*) FROM segments').pluck().get()).toBe(4)
    expect(recordingDone(db)).toBe(5_000)
  })

  it('yalnızca mic kanalı olan eski Recording tek kanallı işlenir', async () => {
    const { db, options, calls } = setup({ mic: 3200 }, async () => fixtureRun('tr-tiny'))

    await transcribeRecording(options)

    expect(calls).toHaveLength(1)
    expect(db.prepare('SELECT DISTINCT channel FROM segments').pluck().all()).toEqual(['mic'])
    expect(recordingDone(db)).toBe(5_000)
  })

  it('ses içermeyen kanal whisper çalıştırılmadan sıfır segmentle tamamlanır', async () => {
    const { db, options, calls } = setup({ mic: 3200, system: 0 }, async () =>
      fixtureRun('tr-tiny')
    )

    const result = await transcribeRecording(options)

    expect(calls.map((call) => call.wavPath.split('/').pop())).toEqual(['mic.wav'])
    expect(result.segments).toBe(2)
    expect(channelRows(db)).toEqual([
      { kind: 'mic', transcribed_at: 5_000 },
      { kind: 'system', transcribed_at: 5_000 }
    ])
    expect(recordingDone(db)).toBe(5_000)
  })

  it('tüm kanallar işlenmiş ama Recording işaretlenmemişse yalnızca işaret tamamlanır', async () => {
    const { db, options, calls } = setup({ mic: 3200, system: 3200 }, async () =>
      fixtureRun('tr-tiny')
    )
    db.prepare('UPDATE recording_channels SET transcribed_at = 4000').run()

    const result = await transcribeRecording(options)

    expect(calls).toHaveLength(0)
    expect(result.segments).toBe(0)
    expect(recordingDone(db)).toBe(5_000)
  })
})
