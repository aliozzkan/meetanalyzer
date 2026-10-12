import { BrowserWindow, ipcMain } from 'electron'
import { statusShape, type TranscriptionStatus } from '../../shared/transcription'
import { PROGRESS_BROADCAST_INTERVAL_MS } from '../config'
import { toIpcResult } from '../ipc-result'
import { MeetingError } from '../meetings/meeting-service'
import type { TranscriptionQueue } from './transcription-queue'

// Durumu tüm pencerelere iletir. Yalnızca yüzde değiştiğinde (sık gelen ilerleme) güncellemeler seyreltilir;
// Meeting'lerin giriş/çıkışı hemen iletilir.
export function createStatusBroadcaster(): (status: TranscriptionStatus) => void {
  let lastSent = 0
  let lastShape = ''
  return (status) => {
    const shape = statusShape(status)
    const time = Date.now()
    if (shape === lastShape && time - lastSent < PROGRESS_BROADCAST_INTERVAL_MS) return
    lastShape = shape
    lastSent = time
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('transcription:status', status)
    }
  }
}

export function registerTranscriptionIpc(queue: TranscriptionQueue): void {
  ipcMain.handle('transcription:get-status', () => queue.getStatus())
  ipcMain.handle('transcription:enqueue', (_event, meetingId: string) =>
    toIpcResult(MeetingError, 'internal-error', () => queue.enqueue(meetingId))
  )
}
