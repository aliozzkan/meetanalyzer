import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Language, MeetingResult, MeetingSummary } from '../shared/meeting'
import type { ModelState } from '../shared/model'
import type { Transcript, TranscriptResult, WordAudio } from '../shared/transcript'
import type { TranscriptionStatus } from '../shared/transcription'
import type { RecordingResult, RecordingSummary } from '../shared/recording'

// Custom APIs for renderer
const api = {
  meetings: {
    list: (): Promise<MeetingResult<MeetingSummary[]>> => ipcRenderer.invoke('meetings:list'),
    start: (language: Language): Promise<MeetingResult<MeetingSummary>> =>
      ipcRenderer.invoke('meetings:start', language),
    close: (id: string): Promise<MeetingResult<MeetingSummary>> =>
      ipcRenderer.invoke('meetings:close', id),
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
