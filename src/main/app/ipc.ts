import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { AppInfo } from '../../shared/settings'
import { WHISPER_CPP_VERSION } from '../config'

interface AppIpcOptions {
  dataDir: string
  createWindow: () => void
}

export interface AppIpc {
  /** Uygulama menüsündeki "Ayarlar…" (⌘,): renderer Ayarlar dialog'unu açar. */
  openSettings: () => void
}

export function registerAppIpc({ dataDir, createWindow }: AppIpcOptions): AppIpc {
  ipcMain.handle('app:get-info', (): AppInfo => ({
    appVersion: app.getVersion(),
    whisperVersion: WHISPER_CPP_VERSION
  }))
  // `shell.openPath` hata mesajı döndürür (başarılıysa boş); renderer kullanıcıya gösterir.
  ipcMain.handle('app:show-data-folder', async () => (await shell.openPath(dataDir)) || null)

  // Pencere yokken (macOS'ta kapatılmışsa) yeni renderer mesajı dinlemeye başlamadan gönderilen mesaj
  // kaybolur; bu yüzden istek saklanır ve renderer açılırken kendisi sorar.
  let settingsPending = false
  ipcMain.handle('app:take-pending-settings', () => {
    const pending = settingsPending
    settingsPending = false
    return pending
  })

  return {
    openSettings: () => {
      const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!window) {
        settingsPending = true
        createWindow()
        return
      }
      window.show()
      window.webContents.send('app:open-settings')
    }
  }
}
