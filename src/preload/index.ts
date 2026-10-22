import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Language, MeetingResult, MeetingSummary } from '../shared/meeting'
import type { ModelState } from '../shared/model'
import type { Transcript, TranscriptResult, WordAudio } from '../shared/transcript'
import type { TranscriptionStatus } from '../shared/transcription'
import type { RecordingResult, RecordingSummary } from '../shared/recording'
import type { AppCommand, AppInfo } from '../shared/app'
import type { SettingsResult, Theme } from '../shared/settings'

// Custom APIs for renderer
const api = {
  meetings: {
    list: (): Promise<MeetingResult<MeetingSummary[]>> => ipcRenderer.invoke('meetings:list'),
    start: (language: Language): Promise<MeetingResult<MeetingSummary>> =>
      ipcRenderer.invoke('meetings:start', language),
    close: (id: string): Promise<MeetingResult<MeetingSummary>> =>
      ipcRenderer.invoke('meetings:close', id),
    rename: (id: string, title: string): Promise<MeetingResult<MeetingSummary>> =>
      ipcRenderer.invoke('meetings:rename', id, title),
    remove: (id: string): Promise<MeetingResult<void>> => ipcRenderer.invoke('meetings:remove', id)
  },
  recordings: {
    start: (meetingId: string): Promise<RecordingResult<RecordingSummary>> =>
      ipcRenderer.invoke('recordings:start', meetingId),
    append: (recordingId: string, pcm: Uint8Array): Promise<RecordingResult<void>> =>
      ipcRenderer.invoke('recordings:append', recordingId, pcm),
    stop: (recordingId: string): Promise<RecordingResult<RecordingSummary>> =>
      ipcRenderer.invoke('recordings:stop', recordingId),
    discard: (recordingId: string): Promise<RecordingResult<void>> =>
      ipcRenderer.invoke('recordings:discard', recordingId),
    openMicrophoneSettings: (): Promise<void> =>
      ipcRenderer.invoke('recordings:open-microphone-settings')
  },
  transcription: {
    enqueue: (meetingId: string): Promise<MeetingResult<MeetingSummary>> =>
      ipcRenderer.invoke('transcription:enqueue', meetingId),
    getStatus: (): Promise<TranscriptionStatus> => ipcRenderer.invoke('transcription:get-status'),
    onStatus: (callback: (status: TranscriptionStatus) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: TranscriptionStatus): void =>
        callback(status)
      ipcRenderer.on('transcription:status', listener)
      return () => ipcRenderer.removeListener('transcription:status', listener)
    }
  },
  transcript: {
    get: (meetingId: string): Promise<TranscriptResult<Transcript>> =>
      ipcRenderer.invoke('transcript:get', meetingId),
    correct: (wordId: string, corrected: string): Promise<TranscriptResult<string>> =>
      ipcRenderer.invoke('transcript:correct', wordId, corrected),
    wordAudio: (wordId: string): Promise<TranscriptResult<WordAudio>> =>
      ipcRenderer.invoke('transcript:word-audio', wordId),
    approve: (meetingId: string): Promise<TranscriptResult<void>> =>
      ipcRenderer.invoke('transcript:approve', meetingId),
    approvedText: (meetingId: string): Promise<TranscriptResult<string>> =>
      ipcRenderer.invoke('transcript:approved-text', meetingId),
    revert: (wordId: string): Promise<TranscriptResult<void>> =>
      ipcRenderer.invoke('transcript:revert', wordId)
  },
  model: {
    getState: (): Promise<ModelState> => ipcRenderer.invoke('model:get-state'),
    start: (): Promise<ModelState> => ipcRenderer.invoke('model:start'),
    cancel: (): Promise<void> => ipcRenderer.invoke('model:cancel'),
    // Durum değişikliklerine abone olur; dönen işlev aboneliği kaldırır.
    onState: (callback: (state: ModelState) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: ModelState): void =>
        callback(state)
      ipcRenderer.on('model:state', listener)
      return () => ipcRenderer.removeListener('model:state', listener)
    }
  },
  settings: {
    getDefaultLanguage: (): Promise<SettingsResult<Language>> =>
      ipcRenderer.invoke('settings:get-default-language'),
    setDefaultLanguage: (language: Language): Promise<SettingsResult<void>> =>
      ipcRenderer.invoke('settings:set-default-language', language),
    setTheme: (theme: Theme): Promise<SettingsResult<void>> =>
      ipcRenderer.invoke('settings:set-theme', theme)
  },
  app: {
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:get-info'),
    /** Veri klasörünü açar; açılamazsa hata mesajını döndürür. */
    showDataFolder: (): Promise<string | null> => ipcRenderer.invoke('app:show-data-folder'),
    /** Pencere yokken menüden seçilen komut; bir kez döner, yoksa null (bkz. src/main/app/ipc.ts). */
    takePendingCommand: (): Promise<AppCommand | null> =>
      ipcRenderer.invoke('app:take-pending-command'),
    // Uygulama menüsünden gelen komutlar; dönen işlev aboneliği kaldırır.
    onCommand: (callback: (command: AppCommand) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, command: AppCommand): void =>
        callback(command)
      ipcRenderer.on('app:command', listener)
      return () => ipcRenderer.removeListener('app:command', listener)
    },
    isFullScreen: (): Promise<boolean> => ipcRenderer.invoke('app:is-full-screen'),
    // Pencere tam ekrana girip çıktıkça çağrılır; dönen işlev aboneliği kaldırır.
    onFullScreenChange: (callback: (fullScreen: boolean) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, fullScreen: boolean): void =>
        callback(fullScreen)
      ipcRenderer.on('app:full-screen', listener)
      return () => ipcRenderer.removeListener('app:full-screen', listener)
    }
  }
}

export type Api = typeof api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
