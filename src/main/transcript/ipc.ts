import { ipcMain } from 'electron'
import { toIpcResult } from '../ipc-result'
import { TranscriptError, type TranscriptService } from './transcript-service'

const run = <T>(action: () => T): ReturnType<typeof toIpcResult<T, TranscriptError['code']>> =>
  toIpcResult(TranscriptError, 'internal-error', action)

export function registerTranscriptIpc(transcripts: TranscriptService): void {
  ipcMain.handle('transcript:get', (_event, meetingId: string) =>
    run(() => transcripts.get(meetingId))
  )
  ipcMain.handle('transcript:correct', (_event, wordId: string, corrected: string) =>
    run(() => transcripts.correct(wordId, corrected))
  )
  ipcMain.handle('transcript:revert', (_event, wordId: string) =>
    run(() => transcripts.revert(wordId))
  )
}
