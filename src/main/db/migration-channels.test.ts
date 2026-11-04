import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from './database'
import { migrations } from './migrations'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

// Sistem sesi migration'ından önceki şema: ilk dört migration uygulanmış, tek kanallı veri var.
function legacyDatabase(path: string): void {
  const legacy = new Database(path)
  legacy.pragma('foreign_keys = ON')
  migrations.slice(0, 4).forEach((sql) => legacy.exec(sql))
  legacy.pragma('user_version = 4')
  legacy.exec(`
    INSERT INTO meetings (id, language, state, created_at) VALUES ('m1', 'tr', 'transcribed', 1);
    INSERT INTO recordings (id, meeting_id, seq, started_at, ended_at, transcribed_at)
      VALUES ('r-done', 'm1', 1, 10, 20, 30), ('r-open', 'm1', 2, 40, 50, NULL);
    INSERT INTO recording_channels (recording_id, kind, file_path, duration_ms)
      VALUES ('r-done', 'mic', 'm1/r-done/mic.wav', 1000), ('r-open', 'mic', 'm1/r-open/mic.wav', 2000);
  `)
  legacy.close()
}

describe('sistem sesi migration', () => {
  it('mevcut tek kanallı Recording’ler korunur; transcribed_at mic kanalına taşınır', () => {
    const dir = mkdtempSync(join(tmpdir(), 'meetanalyzing-migration-'))
    tempDirs.push(dir)
    const path = join(dir, 'app.db')
    legacyDatabase(path)

    const db = openDatabase(path)

    expect(
      db
        .prepare(
          'SELECT recording_id, kind, file_path, duration_ms, transcribed_at FROM recording_channels ORDER BY recording_id'
        )
        .all()
    ).toEqual([
      {
        recording_id: 'r-done',
        kind: 'mic',
        file_path: 'm1/r-done/mic.wav',
        duration_ms: 1000,
        transcribed_at: 30
      },
      {
        recording_id: 'r-open',
        kind: 'mic',
        file_path: 'm1/r-open/mic.wav',
        duration_ms: 2000,
        transcribed_at: null
      }
    ])
    // Recording'in kendi transcribed_at'i ("tüm kanallar bitti") dokunulmadan kalır.
    expect(db.prepare('SELECT transcribed_at FROM recordings ORDER BY id').pluck().all()).toEqual([
      30,
      null
    ])
  })

  it("'system' kanalı eklenebilir, bilinmeyen kanal reddedilir; Recording silinince kanallar da gider", () => {
    const dir = mkdtempSync(join(tmpdir(), 'meetanalyzing-migration-'))
    tempDirs.push(dir)
    const path = join(dir, 'app.db')
    legacyDatabase(path)
    const db = openDatabase(path)

    db.prepare(
      "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES ('r-open', 'system', 'm1/r-open/system.wav')"
    ).run()
    expect(() =>
      db
        .prepare(
          "INSERT INTO recording_channels (recording_id, kind, file_path) VALUES ('r-open', 'speaker', 'x')"
        )
        .run()
    ).toThrow()

    db.prepare("DELETE FROM recordings WHERE id = 'r-open'").run()
    expect(
      db
        .prepare("SELECT COUNT(*) FROM recording_channels WHERE recording_id = 'r-open'")
        .pluck()
        .get()
    ).toBe(0)
  })
})
