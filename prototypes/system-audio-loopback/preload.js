const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('proto', {
  setMode: (mode) => ipcRenderer.invoke('proto:set-mode', mode),
  info: () => ipcRenderer.invoke('proto:info'),
  saveWav: (name, bytes) => ipcRenderer.invoke('proto:save-wav', name, bytes)
})
