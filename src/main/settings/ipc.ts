import { ipcMain, nativeTheme } from 'electron'
import type { Language } from '../../shared/meeting'
import { THEMES, type Theme } from '../../shared/settings'
import { toIpcResult } from '../ipc-result'
import { SettingsError, type SettingsService } from './settings-service'

const run = <T>(action: () => T): ReturnType<typeof toIpcResult<T, SettingsError['code']>> =>
  toIpcResult(SettingsError, 'internal-error', action)

export function registerSettingsIpc(settings: SettingsService): void {
  ipcMain.handle('settings:get-default-language', () => run(() => settings.getDefaultLanguage()))
  ipcMain.handle('settings:set-default-language', (_event, language: Language) =>
    run(() => settings.setDefaultLanguage(language))
  )
  // Tema renderer'da saklanır; main yalnızca native menü, scrollbar ve dialog'lar uysun diye izler.
  ipcMain.handle('settings:set-theme', (_event, theme: Theme) =>
    run(() => {
      if (!THEMES.includes(theme)) {
        throw new SettingsError('invalid-input', `Desteklenmeyen tema: ${String(theme)}`)
      }
      nativeTheme.themeSource = theme
    })
  )
}
