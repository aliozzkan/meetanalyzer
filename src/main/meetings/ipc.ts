import { ipcMain } from 'electron'
import type { Language } from '../../shared/meeting'
import { toIpcResult } from '../ipc-result'
import { MeetingError, type MeetingService } from './meeting-service'

const run = <T>(action: () => T): ReturnType<typeof toIpcResult<T, MeetingError['code']>> =>
  toIpcResult(MeetingError, 'internal-error', action)

export function registerMeetingIpc(meetings: MeetingService): void {
  ipcMain.handle('meetings:list', () => run(() => meetings.list()))
  ipcMain.handle('meetings:start', (_event, language: Language) =>
    run(() => meetings.start(language))
  )
  ipcMain.handle('meetings:close', (_event, id: string) => run(() => meetings.close(id)))
  ipcMain.handle('meetings:rename', (_event, id: string, title: string) =>
    run(() => meetings.rename(id, title))
  )
  ipcMain.handle('meetings:remove', (_event, id: string) => run(() => meetings.remove(id)))
}
