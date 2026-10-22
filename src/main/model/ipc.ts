import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { BrowserWindow, ipcMain, shell } from 'electron'
import { PROGRESS_BROADCAST_INTERVAL_MS } from '../config'
import type { ModelState } from '../../shared/model'
import { toIpcResult } from '../ipc-result'
import { ModelError, type ModelService } from './model-service'

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

export function registerModelIpc(model: ModelService, { modelPath }: { modelPath: string }): void {
  ipcMain.handle('model:get-state', () => model.getState())
  // İndirme uzun sürer: başlatılır ve hemen dönülür; ilerleme 'model:state' olaylarıyla gelir.
  ipcMain.handle('model:start', () => {
    void model.start()
    return model.getState()
  })
  ipcMain.handle('model:cancel', () => model.cancel())
  // Silme kuralı (indirme sürüyor / kuyruk dolu) serviste uygulanır; UI'daki devre dışı buton yetmez.
  ipcMain.handle('model:remove', () =>
    toIpcResult(ModelError, 'internal-error', () => {
      model.remove()
      return model.getState()
    })
  )
  // Model kuruluysa dosyası seçili gösterilir, değilse modeller klasörü açılır. Hata mesajını döndürür.
  ipcMain.handle('model:show-in-folder', async () => {
    if (existsSync(modelPath)) {
      shell.showItemInFolder(modelPath)
      return null
    }
    return (await shell.openPath(dirname(modelPath))) || null
  })
}
