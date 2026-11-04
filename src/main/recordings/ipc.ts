import { ipcMain, shell } from 'electron'
import { toIpcResult } from '../ipc-result'
import { microphoneSettingsUrl } from './microphone'
import { RecordingError, type RecordingService } from './recording-service'

const run = <T>(
  action: () => T | Promise<T>
): ReturnType<typeof toIpcResult<T, RecordingError['code']>> =>
  toIpcResult(RecordingError, 'internal-error', action)

export function registerRecordingIpc(recordings: RecordingService): void {
  ipcMain.handle('recordings:start', (_event, meetingId: string) =>
    run(() => recordings.start(meetingId))
  )
  // IPC, ArrayBuffer görünümlerini Uint8Array olarak iletir.
  ipcMain.handle('recordings:append', (_event, recordingId: string, pcm: Uint8Array) =>
    run(() =>
      recordings.append(recordingId, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength))
    )
  )
  ipcMain.handle('recordings:stop', (_event, recordingId: string) =>
    run(() => recordings.stop(recordingId))
  )
  ipcMain.handle('recordings:discard', (_event, recordingId: string) =>
    run(() => recordings.discard(recordingId))
  )
  ipcMain.handle('recordings:open-microphone-settings', async () => {
    const url = microphoneSettingsUrl(process.platform)
    if (url) await shell.openExternal(url)
  })
}
