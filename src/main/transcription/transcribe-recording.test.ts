import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../db/database'
import { TranscriptionError } from './errors'
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
  recordingsDir: string
  options: TranscribeRecordingOptions
  calls: RunWhisperOptions[]
}

// Bellek içi DB'de bir Meeting, bir Recording ve diskte ses dosyası kurar; çalıştırıcı sahtedir.
function setup(run: (options: RunWhisperOptions) => Promise<WhisperRun>): Setup {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-transcribe-'))
  tempDirs.push(recordingsDir)
  db.prepare(
    "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'closed', 1)"
  ).run()
  db.prepare(
    'INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at) VALUES (?, ?, 1, 1, 2)'
  ).run('r1', 'm1')
  db.prepare(
    "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES ('r1', 'mic', 'm1/r1/mic.wav')"
  ).run()
  mkdirSync(join(recordingsDir, 'm1', 'r1'), { recursive: true })
  writeFileSync(join(recordingsDir, 'm1', 'r1', 'mic.wav'), Buffer.alloc(44 + 3200))

  const calls: RunWhisperOptions[] = []
  return {
    db,
    recordingsDir,
    calls,
    options: {
      db,
      recordingsDir,
      recordingId: 'r1',
      language: 'tr',
      suspectThreshold: 0.5,
      whisper: { cliPath: '/cli', modelPath: '/model', vadModelPath: '/vad', threads: 3, nice: 10 },
      now: () => 5_000,
      run: (runOptions) => {
        calls.push(runOptions)
        return run(runOptions)
      }
    }
  }
}

const count = (db: Db, table: string): number =>
  db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get() as number

describe('transcribeRecording', () => {
  it('Recording’i transcribe eder; segment ve kelimeleri yazar, transcribed_at’i set eder', async () => {
    const { db, options, calls } = setup(async () => fixtureRun('tr-tiny'))

    const result = await transcribeRecording(options)

    expect(result).toEqual({ segments: 2, words: 16, suspects: 8 })
    expect(db.prepare('SELECT seq FROM segments ORDER BY seq').pluck().all()).toEqual([1, 2])
    const words = db
      .prepare(
        `SELECT w.text, w.is_suspect AS suspect, w.start_ms AS start, s.seq AS segment, w.seq AS wseq
         FROM words w JOIN segments s ON s.id = w.segment_id ORDER BY s.seq, w.seq`
      )
      .all() as { text: string; suspect: number; start: number; segment: number; wseq: number }[]
    expect(words.map((w) => w.text).slice(0, 6)).toEqual([
      "Ankara'daki",
      'toplantı',
      'yayarın',
      'saat',
      '14',
      'tebaşlayacağız.'
    ])
    expect(words.filter((w) => w.suspect).map((w) => w.text)).toEqual([
      'toplantı',
      'saat',
      'tebaşlayacağız.',
      'Ayşe',
      'hanım',
      'çağlar',
      'beye',
      'ekibinden'
    ])
    // Kelime zamanı VAD eşlemesinden geçmiştir: 'hanım' sıkıştırılmış 4540 ms -> orijinal 11 770 ms
    expect(words.find((w) => w.text === 'hanım')!.start).toBe(11_770)
    expect(words.filter((w) => w.segment === 2).map((w) => w.wseq)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10
    ])
    expect(db.prepare("SELECT transcribed_at FROM recordings WHERE id = 'r1'").pluck().get()).toBe(
      5_000
    )
    // çalıştırıcıya Meeting'in dili, doğru ses dosyası ve ayarlar verildi
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      language: 'tr',
      threads: 3,
      nice: 10,
      cliPath: '/cli',
      modelPath: '/model',
      vadModelPath: '/vad'
    })
    expect(calls[0].wavPath.endsWith(join('m1', 'r1', 'mic.wav'))).toBe(true)
  })

  it('ilerleme ve iptal sinyali çalıştırıcıya iletilir', async () => {
    const controller = new AbortController()
    const progress: number[] = []
    const { options } = setup(async (runOptions) => {
      runOptions.onProgress?.(40)
      expect(runOptions.signal).toBe(controller.signal)
      return fixtureRun('en-gap')
    })

    await transcribeRecording({
      ...options,
      signal: controller.signal,
      onProgress: (percent) => progress.push(percent)
    })

    expect(progress).toEqual([40])
  })

  it.each([
    [
      'çalıştırıcı hata verirse',
      async () => {
        throw new TranscriptionError('whisper-failed', 'x')
      },
      'whisper-failed'
    ],
    [
      'iptal edilirse',
      async () => {
        throw new TranscriptionError('cancelled', 'x')
      },
      'cancelled'
    ],
    ['çıktı bozuksa', async () => ({ json: { yanlis: true }, stderr: '' }), 'invalid-output']
  ])('%s hiçbir şey yazılmaz', async (_name, run, code) => {
    const { db, options } = setup(run)

    await expect(transcribeRecording(options)).rejects.toMatchObject({ code })

    expect(count(db, 'segments')).toBe(0)
    expect(count(db, 'words')).toBe(0)
    expect(
      db.prepare("SELECT transcribed_at FROM recordings WHERE id = 'r1'").pluck().get()
    ).toBeNull()
  })

  it('yazma sırasında bir hata olursa tek işlem geri alınır: yarım Transcript kalmaz', async () => {
    const { db, options } = setup(async () => fixtureRun('tr-gap'))
    // 2. segment (seq 2) zaten varmış gibi çakışma yarat: 1. segmentin eklenmesinden SONRA patlar
    db.prepare(
      "INSERT INTO segments (id, recording_id, seq, start_ms, end_ms) VALUES ('onceden', 'r1', 2, 0, 1)"
    ).run()

    await expect(transcribeRecording(options)).rejects.toBeDefined()

    expect(count(db, 'segments')).toBe(1) // yalnızca önceden var olan
    expect(count(db, 'words')).toBe(0)
    expect(
      db.prepare("SELECT transcribed_at FROM recordings WHERE id = 'r1'").pluck().get()
    ).toBeNull()
  })

  it('transcription sırasında Recording silinirse (ör. Meeting silindi) hiçbir şey yazılmaz', async () => {
    const { db, options } = setup(async () => {
      db.prepare("DELETE FROM meetings WHERE id = 'm1'").run() // cascade ile Recording de gider
      return fixtureRun('tr-gap')
    })

    await expect(transcribeRecording(options)).rejects.toMatchObject({
      code: 'recording-not-found'
    })

    expect(count(db, 'segments')).toBe(0)
    expect(count(db, 'words')).toBe(0)
  })

  it('çalıştırıcı iptal sinyalini yok sayıp dönse bile iptal edilmişse hiçbir şey yazılmaz', async () => {
    const controller = new AbortController()
    const { db, options } = setup(async () => {
      controller.abort() // iptal geldi ama çalıştırıcı sonuç döndürdü
      return fixtureRun('tr-gap')
    })

    await expect(
      transcribeRecording({ ...options, signal: controller.signal })
    ).rejects.toMatchObject({ code: 'cancelled' })

    expect(count(db, 'segments')).toBe(0)
    expect(
      db.prepare("SELECT transcribed_at FROM recordings WHERE id = 'r1'").pluck().get()
    ).toBeNull()
  })

  it('henüz bitmemiş (kayıt sürerken ya da kurtarılmamış) Recording için çalıştırıcıyı çağırmaz', async () => {
    const { db, options, calls } = setup(async () => fixtureRun('tr-gap'))
    db.prepare("UPDATE recordings SET ended_at = NULL WHERE id = 'r1'").run()

    await expect(transcribeRecording(options)).rejects.toMatchObject({
      code: 'recording-not-finished'
    })

    expect(calls).toHaveLength(0)
  })

  it('DB’deki dosya yolu kayıt klasörünün dışına çıkıyorsa TranscriptionError verir (ham hata sızmaz)', async () => {
    const { db, options, calls } = setup(async () => fixtureRun('tr-gap'))
    db.prepare("UPDATE recording_channels SET file_path = '../disari/mic.wav'").run()

    await expect(transcribeRecording(options)).rejects.toMatchObject({ code: 'audio-missing' })

    expect(calls).toHaveLength(0)
  })

  it('hiç ses içermeyen (yalnızca header’lı) Recording whisper çalıştırılmadan sıfır segmentle tamamlanır', async () => {
    const { db, options, calls, recordingsDir } = setup(async () => fixtureRun('tr-gap'))
    // 44 baytlık WAV header'ı, ses yok: gerçek whisper bunu "failed to read audio" ile reddeder (çıkış 11)
    writeFileSync(join(recordingsDir, 'm1', 'r1', 'mic.wav'), Buffer.alloc(44))

    const result = await transcribeRecording(options)

    expect(result).toEqual({ segments: 0, words: 0, suspects: 0 })
    expect(calls).toHaveLength(0)
    expect(count(db, 'segments')).toBe(0)
    expect(db.prepare("SELECT transcribed_at FROM recordings WHERE id = 'r1'").pluck().get()).toBe(
      5_000
    )
  })

  it('zaten transcribe edilmiş, bilinmeyen ya da sesi olmayan Recording için çalıştırıcıyı çağırmaz', async () => {
    const done = setup(async () => fixtureRun('tr-gap'))
    done.db.prepare("UPDATE recordings SET transcribed_at = 1 WHERE id = 'r1'").run()
    await expect(transcribeRecording(done.options)).rejects.toMatchObject({
      code: 'already-transcribed'
    })

    const unknown = setup(async () => fixtureRun('tr-gap'))
    await expect(
      transcribeRecording({ ...unknown.options, recordingId: 'yok' })
    ).rejects.toMatchObject({ code: 'recording-not-found' })

    const noAudio = setup(async () => fixtureRun('tr-gap'))
    rmSync(join(noAudio.recordingsDir, 'm1', 'r1', 'mic.wav'))
    await expect(transcribeRecording(noAudio.options)).rejects.toMatchObject({
      code: 'audio-missing'
    })

    expect(done.calls.length + unknown.calls.length + noAudio.calls.length).toBe(0)
  })
})
