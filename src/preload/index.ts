import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Language, MeetingResult, MeetingSummary } from '../shared/meeting'

// Custom APIs for renderer
const api = {
  meetings: {
    list: (): Promise<MeetingResult<MeetingSummary[]>> => ipcRenderer.invoke('meetings:list'),
    start: (language: Language): Promise<MeetingResult<MeetingSummary>> =>
      ipcRenderer.invoke('meetings:start', language),
    close: (id: string): Promise<MeetingResult<MeetingSummary>> =>
      ipcRenderer.invoke('meetings:close', id),
    remove: (id: string): Promise<MeetingResult<void>> => ipcRenderer.invoke('meetings:remove', id)
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
