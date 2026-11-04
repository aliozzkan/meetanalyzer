import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type Db } from '../db/database'
import { createMeetingService } from '../meetings/meeting-service'
import { purgeApprovedAudio } from '../transcript/approval-service'
import { createRecordingService } from './recording-service'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function setupWithRecording(): Promise<{
  db: Db
  recordingsDir: string
  dir: string
  meetingId: string
  remove: () => void
}> {
  const db = openDatabase(':memory:')
  const recordingsDir = mkdtempSync(join(tmpdir(), 'meetanalyzing-cleanup-'))
  tempDirs.push(recordingsDir)
  const recordings = createRecordingService({
    db,
    recordingsDir,
    requestMicrophoneAccess: async () => 'granted',
    hasSystemAudioConsent: () => true,
    power: { acquire: () => {}, release: () => {} }
  })
  const meetings = createMeetingService({ db, recordingsDir, activeRecordings: recordings })
  const meetingId = meetings.start('tr').id
  const recording = await recordings.start(meetingId)
  recordings.append(recording.id, Buffer.alloc(32_000, 1), 'mic')
  recordings.append(recording.id, Buffer.alloc(32_000, 1), 'system')
  recordings.stop(recording.id)
  const dir = join(recordingsDir, meetingId, recording.id)
  return { db, recordingsDir, dir, meetingId, remove: () => meetings.remove(meetingId) }
}

describe('iki kanallı Recording temizliği', () => {
  it('Meeting silinince mic.wav ve system.wav birlikte kalkar', async () => {
    const { dir, remove } = await setupWithRecording()
    expect(existsSync(join(dir, 'mic.wav'))).toBe(true)
    expect(existsSync(join(dir, 'system.wav'))).toBe(true)

    remove()

    expect(existsSync(join(dir, 'mic.wav'))).toBe(false)
    expect(existsSync(join(dir, 'system.wav'))).toBe(false)
  })

  it('Onaydan sonra iki ses dosyası da silinir ve iki kanalın file_path değeri temizlenir', async () => {
    const { db, recordingsDir, dir, meetingId } = await setupWithRecording()
    db.prepare("UPDATE meetings SET state = 'approved' WHERE id = ?").run(meetingId)

    const purged = purgeApprovedAudio({ db, recordingsDir, meetingId })

    expect(purged).toBe(1)
    expect(existsSync(join(dir, 'mic.wav'))).toBe(false)
    expect(existsSync(join(dir, 'system.wav'))).toBe(false)
    expect(
      db
        .prepare('SELECT COUNT(*) FROM recording_channels WHERE file_path IS NOT NULL')
        .pluck()
        .get()
    ).toBe(0)
  })
})
