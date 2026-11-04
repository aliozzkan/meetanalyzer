import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../db/database'
import { createSettingsService, SettingsError } from './settings-service'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'meetanalyzing-settings-'))
  tempDirs.push(dir)
  return join(dir, 'test.db')
}

describe('settings service', () => {
  it('Default Language hiç seçilmediyse Türkçe döner', () => {
    const settings = createSettingsService({ db: openDatabase(':memory:') })

    expect(settings.getDefaultLanguage()).toBe('tr')
  })

  it('seçilen Default Language uygulama yeniden açılınca korunur', () => {
    const path = tempDbPath()
    const first = openDatabase(path)
    createSettingsService({ db: first }).setDefaultLanguage('en')
    first.close()

    const reopened = openDatabase(path)

    expect(createSettingsService({ db: reopened }).getDefaultLanguage()).toBe('en')
    reopened.close()
  })

  it('desteklenmeyen bir dil reddedilir ve önceki seçim korunur', () => {
    const settings = createSettingsService({ db: openDatabase(':memory:') })
    settings.setDefaultLanguage('en')

    const attempt = (): void => settings.setDefaultLanguage('de' as never)

    expect(attempt).toThrow(SettingsError)
    expect(attempt).toThrow(expect.objectContaining({ code: 'invalid-input' }))
    expect(settings.getDefaultLanguage()).toBe('en')
  })

  it('Mikrofon hiç seçilmediyse null (sistem varsayılanı) döner', () => {
    const settings = createSettingsService({ db: openDatabase(':memory:') })

    expect(settings.getMicrophone()).toBeNull()
  })

  it('seçilen Mikrofon uygulama yeniden açılınca korunur; null seçimi siler', () => {
    const path = tempDbPath()
    const first = openDatabase(path)
    createSettingsService({ db: first }).setMicrophone({ deviceId: 'abc', label: 'USB Mic' })
    first.close()

    const reopened = openDatabase(path)
    const settings = createSettingsService({ db: reopened })
    expect(settings.getMicrophone()).toEqual({ deviceId: 'abc', label: 'USB Mic' })

    settings.setMicrophone(null)
    expect(settings.getMicrophone()).toBeNull()
    reopened.close()
  })

  it('geçersiz Mikrofon seçimi reddedilir ve önceki seçim korunur', () => {
    const settings = createSettingsService({ db: openDatabase(':memory:') })
    settings.setMicrophone({ deviceId: 'abc', label: 'USB Mic' })

    const attempts = [
      { deviceId: '', label: 'x' },
      { deviceId: 'x'.repeat(513), label: 'x' },
      { deviceId: 'abc', label: 'x'.repeat(257) },
      { deviceId: 5, label: 'x' },
      { deviceId: 'abc', label: 5 }
    ]
    for (const attempt of attempts) {
      expect(() => settings.setMicrophone(attempt as never)).toThrow(
        expect.objectContaining({ code: 'invalid-input' })
      )
    }
    expect(settings.getMicrophone()).toEqual({ deviceId: 'abc', label: 'USB Mic' })
  })
})
