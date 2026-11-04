// ATILABİLİR PROTOTİP (system-audio issue 01): uygulamanın koduna bağlı değildir.
// Sistem sesini CoreAudio Tap ile (Electron loopback) yakalayıp 16 kHz mono WAV yazar.
const { app, BrowserWindow, ipcMain, session, systemPreferences, shell } = require('electron')
const { join } = require('path')
const { writeFileSync, mkdirSync } = require('fs')

let loopbackMode = 'loopback' // renderer'dan 'loopbackWithMute' seçilebilir

app.whenReady().then(() => {
  // Yalnızca ses isteniyor: video verilmez. (Ölçüm: video:true olmadan getDisplayMedia çalışıyor mu?)
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    console.log('[main] display media isteği, mod =', loopbackMode)
    try {
      callback({ audio: loopbackMode })
    } catch (error) {
      console.error('[main] callback hatası', error)
      callback({})
    }
  })

  ipcMain.handle('proto:set-mode', (_e, mode) => {
    loopbackMode = mode
  })
  ipcMain.handle('proto:info', () => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    mic: systemPreferences.getMediaAccessStatus('microphone'),
    screen: systemPreferences.getMediaAccessStatus('screen'),
    packaged: app.isPackaged,
    userData: app.getPath('userData')
  }))
  ipcMain.handle('proto:save-wav', (_e, name, bytes) => {
    const dir = join(app.getPath('userData'), 'prototype-out')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, name)
    writeFileSync(file, Buffer.from(bytes))
    shell.showItemInFolder(file)
    return file
  })

  const win = new BrowserWindow({
    width: 900,
    height: 760,
    webPreferences: { preload: join(__dirname, 'preload.js') }
  })
  win.loadFile(join(__dirname, 'index.html'))
})

app.on('window-all-closed', () => app.quit())
