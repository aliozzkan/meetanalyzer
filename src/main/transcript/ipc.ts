import { ipcMain } from 'electron'
import { toIpcResult } from '../ipc-result'
import { TranscriptError, type TranscriptService } from './transcript-service'
import type { ApprovalService } from './approval-service'
import type { WordAudioReader } from './word-audio'

const run = <T>(action: () => T): ReturnType<typeof toIpcResult<T, TranscriptError['code']>> =>
  toIpcResult(TranscriptError, 'internal-error', action)

export function registerTranscriptIpc(
  transcripts: TranscriptService,
  readWordAudio: WordAudioReader,
  approval: ApprovalService
): void {
  ipcMain.handle('transcript:get', (_event, meetingId: string) =>
    run(() => transcripts.get(meetingId))
  )
  ipcMain.handle('transcript:correct', (_event, wordId: string, corrected: string) =>
    run(() => transcripts.correct(wordId, corrected))
  )
  ipcMain.handle('transcript:word-audio', (_event, wordId: string) =>
    run(() => readWordAudio(wordId))
  )
  ipcMain.handle('transcript:approve', (_event, meetingId: string) =>
    run(() => approval.approve(meetingId))
  )
  ipcMain.handle('transcript:approved-text', (_event, meetingId: string) =>
    run(() => approval.getApprovedText(meetingId))
  )
  ipcMain.handle('transcript:revert', (_event, wordId: string) =>
    run(() => transcripts.revert(wordId))
  )
}
