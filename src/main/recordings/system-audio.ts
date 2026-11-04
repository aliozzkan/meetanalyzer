import type { Session } from 'electron'

// macOS 14.2+ "System Audio Recording" gizlilik bölümü (Gizlilik ve Güvenlik › Ekran ve Sistem Ses Kaydı).
// Bu deep link issue 01 ölçümlerinde doğrulanır (system-audio/spec.md → Doğrulanmamış varsayımlar).
export const SYSTEM_AUDIO_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture'

// Renderer'ın hangi izin isteklerine yanıt verilir: mikrofon (yalnızca ses) ve sistem sesi için `getDisplayMedia`
// (`display-capture`). Kamera ve video içeren her medya isteği reddedilir; `display-capture` ise yalnızca
// aşağıdaki display handler'ı ses dışında hiçbir kaynak vermediği için güvenlidir (ekran görüntüsü alınamaz).
export function isPermissionAllowed(
  permission: string,
  details: { mediaTypes?: readonly string[] }
): boolean {
  if (permission === 'display-capture') return true
  if (permission !== 'media') return false
  return !details.mediaTypes?.includes('video')
}

// `getDisplayMedia` isteğine yalnızca bilgisayarın sistem sesini (CoreAudio Tap, loopback) verir; video kaynağı
// asla verilmez. Uygulamanın kendi sesi (ör. Suspect Word dinletmesi) renderer'ın `restrictOwnAudio` kısıtıyla
// dışarıda tutulur (mac-loopback-source.ts).
export function installSystemAudioCapture(session: Session): void {
  session.setDisplayMediaRequestHandler((_request, callback) => {
    try {
      callback({ audio: 'loopback' })
    } catch (error) {
      console.error('Sistem sesi isteği karşılanamadı:', error)
      callback({})
    }
  })
}
