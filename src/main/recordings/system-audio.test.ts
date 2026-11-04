import { describe, expect, it } from 'vitest'
import { isPermissionAllowed } from './system-audio'

describe('isPermissionAllowed', () => {
  it('yalnızca ses isteyen medya (mikrofon) izin alır', () => {
    expect(isPermissionAllowed('media', { mediaTypes: ['audio'] })).toBe(true)
    expect(isPermissionAllowed('media', {})).toBe(true)
  })

  it('video içeren medya isteği (kamera) reddedilir', () => {
    expect(isPermissionAllowed('media', { mediaTypes: ['video'] })).toBe(false)
    expect(isPermissionAllowed('media', { mediaTypes: ['audio', 'video'] })).toBe(false)
  })

  it('sistem sesi için display-capture izin alır', () => {
    expect(isPermissionAllowed('display-capture', {})).toBe(true)
  })

  it('diğer tüm izinler reddedilir', () => {
    for (const permission of ['geolocation', 'notifications', 'clipboard-read', 'midi'])
      expect(isPermissionAllowed(permission, {})).toBe(false)
  })
})
