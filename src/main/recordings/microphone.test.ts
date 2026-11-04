import { describe, expect, it, vi } from 'vitest'
import { checkMicrophoneAccess, microphoneSettingsUrl, type MediaAccessApi } from './microphone'

function api(
  status: string,
  askResult = true
): MediaAccessApi & { askForMediaAccess: ReturnType<typeof vi.fn> } {
  return {
    getMediaAccessStatus: () => status,
    askForMediaAccess: vi.fn(async () => askResult)
  }
}

describe('checkMicrophoneAccess', () => {
  it('macOS: izin verilmişse sormadan granted', async () => {
    const fake = api('granted')
    expect(await checkMicrophoneAccess('darwin', fake)).toBe('granted')
    expect(fake.askForMediaAccess).not.toHaveBeenCalled()
  })

  it('macOS: henüz sorulmamışsa sistem sorusunun cevabını döndürür', async () => {
    expect(await checkMicrophoneAccess('darwin', api('not-determined', true))).toBe('granted')
    expect(await checkMicrophoneAccess('darwin', api('not-determined', false))).toBe('denied')
  })

  it('macOS: reddedilmiş ya da kısıtlıysa denied', async () => {
    expect(await checkMicrophoneAccess('darwin', api('denied'))).toBe('denied')
    expect(await checkMicrophoneAccess('darwin', api('restricted'))).toBe('denied')
  })

  it('Windows: yalnızca açıkça reddedilmişse denied, soru gösterilmez', async () => {
    const denied = api('denied')
    expect(await checkMicrophoneAccess('win32', denied)).toBe('denied')
    expect(denied.askForMediaAccess).not.toHaveBeenCalled()
    expect(await checkMicrophoneAccess('win32', api('granted'))).toBe('granted')
    expect(await checkMicrophoneAccess('win32', api('not-determined'))).toBe('granted')
  })

  it('diğer platformlarda granted', async () => {
    expect(await checkMicrophoneAccess('linux', api('denied'))).toBe('granted')
  })
})

describe('microphoneSettingsUrl', () => {
  it('platformun mikrofon gizlilik sayfasını verir', () => {
    expect(microphoneSettingsUrl('darwin')).toMatch(
      /^x-apple\.systempreferences:.*Privacy_Microphone$/
    )
    expect(microphoneSettingsUrl('win32')).toBe('ms-settings:privacy-microphone')
    expect(microphoneSettingsUrl('linux')).toBeNull()
  })
})
