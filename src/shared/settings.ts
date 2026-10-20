// Main, preload ve renderer'ın ortak kullandığı ayar tipleri.

import type { IpcResult } from './ipc-result'

// Tema arayüz tercihidir: renderer'da saklanır, main'e yalnızca `nativeTheme` için iletilir.
export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export type SettingsErrorCode = 'invalid-input' | 'internal-error'

export type SettingsResult<T> = IpcResult<T, SettingsErrorCode>
