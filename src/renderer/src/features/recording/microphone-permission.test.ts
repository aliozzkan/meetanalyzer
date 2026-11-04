import { describe, expect, it } from 'vitest'
import { microphonePermissionCopy } from './microphone-permission'

describe('microphonePermissionCopy', () => {
  it('macOS: Sistem Ayarları yolunu ve düğmesini gösterir', () => {
    const copy = microphonePermissionCopy('mac')
    expect(copy.instructions).toContain('Sistem Ayarları > Gizlilik ve Güvenlik > Mikrofon')
    expect(copy.settingsButton).toBe("Sistem Ayarları'nı aç")
  })

  it('Windows: Ayarlar yolunu, masaüstü uygulamaları anahtarını ve düğmesini gösterir', () => {
    const copy = microphonePermissionCopy('windows')
    expect(copy.instructions).toContain('Ayarlar > Gizlilik ve güvenlik > Mikrofon')
    expect(copy.instructions).toContain('Masaüstü uygulamalarının')
    expect(copy.instructions).not.toContain('Sistem Ayarları')
    expect(copy.settingsButton).toBe("Ayarlar'ı aç")
  })

  it('diğer platformlarda ayarlar düğmesi yoktur', () => {
    expect(microphonePermissionCopy('other').settingsButton).toBeNull()
  })
})
