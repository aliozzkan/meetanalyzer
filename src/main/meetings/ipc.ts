import { ipcMain } from 'electron'
import type { Language, MeetingResult } from '../../shared/meeting'
import { MeetingError, type MeetingService } from './meeting-service'

// Servis hataları kodlarıyla döner. Beklenmeyen hatalar (geçersiz IPC girdisi, SQLite, dosya sistemi)
// loglanır ve renderer'a genel bir sonuç olarak iletilir; böylece UI hep bir cevap alır.
function toResult<T>(action: () => T): MeetingResult<T> {
  try {
    return { ok: true, value: action() }
  } catch (error) {
    if (error instanceof MeetingError) {
      return { ok: false, code: error.code, message: error.message }
    }
    console.error('Beklenmeyen Meeting hatası:', error)
    return { ok: false, code: 'internal-error', message: 'Beklenmeyen bir hata oluştu.' }
  }
}

export function registerMeetingIpc(meetings: MeetingService): void {
  ipcMain.handle('meetings:list', () => toResult(() => meetings.list()))
  ipcMain.handle('meetings:start', (_event, language: Language) =>
    toResult(() => meetings.start(language))
  )
  ipcMain.handle('meetings:close', (_event, id: string) => toResult(() => meetings.close(id)))
  ipcMain.handle('meetings:remove', (_event, id: string) => toResult(() => meetings.remove(id)))
}
