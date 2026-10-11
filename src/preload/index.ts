import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Language, MeetingResult, MeetingSummary } from '../shared/meeting'
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
