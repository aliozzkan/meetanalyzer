import { BrowserWindow, ipcMain } from 'electron'
import type { TranscriptionStatus } from '../../shared/transcription'
import { toIpcResult } from '../ipc-result'
import { MeetingError } from '../meetings/meeting-service'
import type { TranscriptionQueue } from './transcription-queue'

const PROGRESS_INTERVAL_MS = 250

// Durumu tüm pencerelere iletir. Yalnızca yüzde değiştiğinde (sık gelen ilerleme) güncellemeler seyreltilir;
// Meeting'lerin giriş/çıkışı hemen iletilir.
export function createStatusBroadcaster(): (status: TranscriptionStatus) => void {
  let lastSent = 0
  let lastShape = ''
  return (status) => {
    const shape = JSON.stringify([status.active?.meetingId ?? null, status.queued])
    const time = Date.now()
    if (shape === lastShape && time - lastSent < PROGRESS_INTERVAL_MS) return
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
