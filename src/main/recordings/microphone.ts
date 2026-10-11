import { systemPreferences } from 'electron'
import type { MicrophoneAccess } from './recording-service'

// macOS mikrofon izni: ilk kullanımda sistem sorusunu gösterir. Daha önce reddedilmişse macOS
// soruyu bir daha sormaz; kullanıcı Sistem Ayarları'ndan izin vermelidir.
export async function requestMicrophoneAccess(): Promise<MicrophoneAccess> {
  if (process.platform !== 'darwin') return 'granted'

  const status = systemPreferences.getMediaAccessStatus('microphone')
  if (status === 'granted') return 'granted'
  if (status === 'not-determined') {
    return (await systemPreferences.askForMediaAccess('microphone')) ? 'granted' : 'denied'
  }
  return 'denied' // denied | restricted | unknown
}

export const MICROPHONE_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
