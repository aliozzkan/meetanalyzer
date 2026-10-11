import { BrowserWindow, ipcMain } from 'electron'
import type { ModelState } from '../../shared/model'
import type { ModelService } from './model-service'

const PROGRESS_INTERVAL_MS = 250

// Durum değişikliklerini tüm pencerelere iletir; sık gelen ilerleme güncellemeleri seyreltilir.
export function createStateBroadcaster(): (state: ModelState) => void {
  let lastProgressAt = 0
  return (state) => {
    if (state.status === 'downloading') {
      const now = Date.now()
      if (now - lastProgressAt < PROGRESS_INTERVAL_MS) return
      lastProgressAt = now
    }
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('model:state', state)
  }
}

export function registerModelIpc(model: ModelService): void {
  ipcMain.handle('model:get-state', () => model.getState())
  // İndirme uzun sürer: başlatılır ve hemen dönülür; ilerleme 'model:state' olaylarıyla gelir.
  ipcMain.handle('model:start', () => {
    void model.start()
    return model.getState()
  })
  ipcMain.handle('model:cancel', () => model.cancel())
}
