import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openDatabase } from '../db/database'
import type { PowerGuard } from '../power/power-guard'
import { createRecordingService } from './recording-service'

// closeSync'i kontrollü biçimde başarısız yapar: tanıtıcı gerçekten kapanır, ardından hata fırlatılır.
const control = vi.hoisted(() => ({ failClose: false }))
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    closeSync: (fd: number): void => {
      actual.closeSync(fd)
      if (control.failClose) throw new Error('kapatma hatası (simüle)')
    }
  }
})

const tempDirs: string[] = []
afterEach(() => {
  control.failClose = false
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function activeRecording(): Promise<{
  recordings: ReturnType<typeof createRecordingService>
  recordingId: string
  events: string[]
}> {
  const db = openDatabase(':memory:')
  db.prepare(
    "INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'recording', 1)"
  ).run()
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-close-'))
  tempDirs.push(recordingsDir)
  const events: string[] = []
  const power: PowerGuard = {
    acquire: (reason) => events.push(`acquire:${reason}`),
    release: (reason) => events.push(`release:${reason}`)
  }
  const recordings = createRecordingService({
    db,
    recordingsDir,
    requestMicrophoneAccess: async () => 'granted',
    power
  })
  const recording = await recordings.start('m1')
  return { recordings, recordingId: recording.id, events }
}

describe('dosya kapatma hatası', () => {
  it('stop: kayıt aktif kalmaz ve uyku engeli bırakılır', async () => {
    const { recordings, recordingId, events } = await activeRecording()
    control.failClose = true

    expect(() => recordings.stop(recordingId)).toThrow('kapatma hatası')

    expect(recordings.hasActive('m1')).toBe(false)
    expect(events).toEqual(['acquire:recording', 'release:recording'])
  })

  it('discard: kayıt aktif kalmaz ve uyku engeli bırakılır', async () => {
    const { recordings, recordingId, events } = await activeRecording()
    control.failClose = true

    expect(() => recordings.discard(recordingId)).toThrow('kapatma hatası')

    expect(recordings.hasActive('m1')).toBe(false)
    expect(events).toEqual(['acquire:recording', 'release:recording'])
  })

  it('abortMeeting: kayıt aktif kalmaz ve uyku engeli bırakılır', async () => {
    const { recordings, events } = await activeRecording()
    control.failClose = true

    expect(() => recordings.abortMeeting('m1')).toThrow('kapatma hatası')

    expect(recordings.hasActive('m1')).toBe(false)
    expect(events).toEqual(['acquire:recording', 'release:recording'])
  })
})
