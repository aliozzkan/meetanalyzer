import { BrowserWindow, ipcMain, shell } from 'electron'
import { PROGRESS_BROADCAST_INTERVAL_MS } from '../config'
import type { ModelState } from '../../shared/model'
import { toIpcResult } from '../ipc-result'
import { ModelRemoveError, type ModelService } from './model-service'

// Durum değişikliklerini tüm pencerelere iletir; sık gelen ilerleme güncellemeleri seyreltilir.
export function createStateBroadcaster(): (state: ModelState) => void {
  let lastProgressAt = 0
  return (state) => {
    if (state.status === 'downloading') {
      const now = Date.now()
      if (now - lastProgressAt < PROGRESS_BROADCAST_INTERVAL_MS) return
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
  // Silme kuralı (indirme sürüyor / kuyruk dolu) serviste uygulanır; UI'daki devre dışı buton yetmez.
  ipcMain.handle('model:remove', () =>
    toIpcResult(ModelRemoveError, 'internal-error', () => {
      model.remove()
      return model.getState()
    })
  )
  // Model dosyası varsa seçili gösterilir, yoksa modeller klasörü açılır. Hata mesajını döndürür.
  ipcMain.handle('model:show-in-folder', async () => {
    const location = model.location()
    if (location.kind === 'file') {
      shell.showItemInFolder(location.path)
      return null
    }
    return (await shell.openPath(location.path)) || null
  })
}
