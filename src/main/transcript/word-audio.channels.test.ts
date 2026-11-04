import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../db/database'
import { createWordAudioReader } from './word-audio'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('createWordAudioReader: kanal', () => {
  it('Suspect Word dinletmesi kelimenin kendi kanalının dosyasını çalar', () => {
    const db = openDatabase(':memory:')
    const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-wordaudio-'))
    tempDirs.push(recordingsDir)
    db.exec(`
      INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'transcribed', 1);
      INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at, transcribed_at)
        VALUES ('r1', 'm1', 1, 1, 2, 3);
      INSERT INTO recording_channels (recording_id, kind, file_path)
        VALUES ('r1', 'mic', 'm1/r1/mic.wav'), ('r1', 'system', 'm1/r1/system.wav');
      INSERT INTO segments (id, recording_id, seq, start_ms, end_ms, channel)
        VALUES ('s-mic', 'r1', 1, 0, 1000, 'mic'), ('s-sys', 'r1', 2, 0, 1000, 'system');
      INSERT INTO words (id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect)
        VALUES ('w-mic', 's-mic', 1, 'ben', 0, 500, 0.2, 1), ('w-sys', 's-sys', 1, 'sen', 0, 500, 0.2, 1);
    `)
    mkdirSync(join(recordingsDir, 'm1', 'r1'), { recursive: true })
    const wav = (byte: number): Buffer =>
      Buffer.concat([Buffer.alloc(44), Buffer.alloc(32_000, byte)]) // 1 sn ses
    writeFileSync(join(recordingsDir, 'm1', 'r1', 'mic.wav'), wav(1))
    writeFileSync(join(recordingsDir, 'm1', 'r1', 'system.wav'), wav(2))
    const read = createWordAudioReader({ db, recordingsDir, paddingMs: 0 })

    const mic = read('w-mic')
    const system = read('w-sys')

    expect(mic.pcm.length).toBeGreaterThan(0)
    expect(new Set(mic.pcm)).toEqual(new Set([1]))
    expect(system.pcm.length).toBeGreaterThan(0)
    expect(new Set(system.pcm)).toEqual(new Set([2]))
  })
})
