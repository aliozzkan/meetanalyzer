import { describe, expect, it } from 'vitest'
import { openDatabase } from '../db/database'
import { createSettingsService } from './settings-service'

describe('sistem sesi bilgilendirmesi ayarı', () => {
  it('başlangıçta kabul edilmemiştir; kabul saklanır ve kalıcıdır', () => {
    const db = openDatabase(':memory:')
    const settings = createSettingsService({ db })
    expect(settings.hasSystemAudioConsent()).toBe(false)

    settings.acceptSystemAudioConsent()

    expect(settings.hasSystemAudioConsent()).toBe(true)
    // Aynı veritabanından yeni servis de kabulü görür; kabul tekrar sorulmaz.
    expect(createSettingsService({ db }).hasSystemAudioConsent()).toBe(true)
  })

  it('kabulü tekrar kabul etmek hata vermez', () => {
    const settings = createSettingsService({ db: openDatabase(':memory:') })
    settings.acceptSystemAudioConsent()
    expect(() => settings.acceptSystemAudioConsent()).not.toThrow()
  })
})
