import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { AppCommand, AppInfo } from '../../shared/app'
import { WHISPER_CPP_VERSION } from '../config'

interface AppIpcOptions {
  dataDir: string
  createWindow: () => void
}

export interface AppIpc {
  /** Uygulama menüsünden gelen komutu renderer'a iletir (ör. "Ayarlar…" ⌘,, "Yeni Meeting" ⌘N). */
  sendCommand: (command: AppCommand) => void
}

/** Pencerenin tam ekrana girip çıkışını renderer'a bildirir (ilk değer `app:is-full-screen` ile okunur). */
export function forwardFullScreen(window: BrowserWindow): void {
  window.on('enter-full-screen', () => window.webContents.send('app:full-screen', true))
  window.on('leave-full-screen', () => window.webContents.send('app:full-screen', false))
}

export function registerAppIpc({ dataDir, createWindow }: AppIpcOptions): AppIpc {
  ipcMain.handle('app:get-info', (): AppInfo => ({
    appVersion: app.getVersion(),
    whisperVersion: WHISPER_CPP_VERSION
  }))
  // `shell.openPath` hata mesajı döndürür (başarılıysa boş); renderer kullanıcıya gösterir.
  ipcMain.handle('app:show-data-folder', async () => (await shell.openPath(dataDir)) || null)

  // Pencere yokken (macOS'ta kapatılmışsa) yeni renderer mesajı dinlemeye başlamadan gönderilen mesaj
  // kaybolur; bu yüzden komut saklanır ve renderer açılırken kendisi sorar.
  let pendingCommand: AppCommand | null = null
  ipcMain.handle('app:take-pending-command', () => {
    const command = pendingCommand
    pendingCommand = null
    return command
  })

  // Tam ekranda trafik ışıkları kaybolur; renderer header'daki boşluğu buna göre açar/kapatır.
  ipcMain.handle(
    'app:is-full-screen',
    (event) => BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  )

  return {
    sendCommand: (command) => {
      const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!window) {
        pendingCommand = command
        createWindow()
        return
      }
      window.show()
      window.webContents.send('app:command', command)
    }
  }
}
