import { systemPreferences } from 'electron'
import type { MicrophoneAccess } from './recording-service'

// Electron'un `systemPreferences` API'sinin kullandığımız kısmı; testlerde sahtesi geçilir.
export interface MediaAccessApi {
  getMediaAccessStatus: (mediaType: 'microphone') => string
  askForMediaAccess: (mediaType: 'microphone') => Promise<boolean>
}

// Mikrofon izni, Recording açılmadan önce sorulur; izin yoksa boş bir Recording oluşmaz.
// - macOS: ilk kullanımda sistem sorusunu gösterir. Daha önce reddedilmişse macOS soruyu bir daha sormaz;
//   kullanıcı Sistem Ayarları'ndan izin vermelidir.
// - Windows: soru yoktur; izin Ayarlar > Gizlilik ve güvenlik > Mikrofon'dan verilir. Yalnızca açıkça
//   reddedilmişse 'denied' döner; belirsiz durumda renderer'daki getUserMedia hatası aynı arayüzü gösterir.
export async function checkMicrophoneAccess(
  platform: NodeJS.Platform,
  api: MediaAccessApi
): Promise<MicrophoneAccess> {
  if (platform === 'win32') {
    return api.getMediaAccessStatus('microphone') === 'denied' ? 'denied' : 'granted'
  }
  if (platform !== 'darwin') return 'granted'

  const status = api.getMediaAccessStatus('microphone')
  if (status === 'granted') return 'granted'
  if (status === 'not-determined') {
    return (await api.askForMediaAccess('microphone')) ? 'granted' : 'denied'
  }
  return 'denied' // denied | restricted | unknown
}

export function requestMicrophoneAccess(): Promise<MicrophoneAccess> {
  return checkMicrophoneAccess(process.platform, systemPreferences)
}

// Mikrofon izninin verildiği sistem ayarları sayfası; bu platformda yoksa null.
export function microphoneSettingsUrl(platform: NodeJS.Platform): string | null {
  if (platform === 'darwin') {
    return 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
  }
  if (platform === 'win32') return 'ms-settings:privacy-microphone'
  return null
}
