// Main, preload ve renderer'ın ortak kullandığı ayar tipleri.

import type { IpcResult } from './ipc-result'

// Tema arayüz tercihidir: renderer'da saklanır, main'e yalnızca `nativeTheme` için iletilir.
export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

/**
 * Kullanıcının seçtiği mikrofon. `null` seçim "Sistem varsayılanı"dır. Etiket, cihaz bağlı olmadığında
 * ayarlarda adını gösterebilmek için saklanır (cihaz kimliği tek başına okunamaz).
 */
export interface MicrophoneSelection {
  deviceId: string
  label: string
}

export const MICROPHONE_DEVICE_ID_MAX = 512
export const MICROPHONE_LABEL_MAX = 256

export type SettingsErrorCode = 'invalid-input' | 'internal-error'

export type SettingsResult<T> = IpcResult<T, SettingsErrorCode>
