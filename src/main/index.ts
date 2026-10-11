import { app, shell, BrowserWindow, dialog, powerSaveBlocker, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { openDatabase, type Db } from './db/database'
import { registerMeetingIpc } from './meetings/ipc'
import { createMeetingService } from './meetings/meeting-service'
import { createPowerGuard } from './power/power-guard'
import { requestMicrophoneAccess } from './recordings/microphone'
import { recoverInterruptedRecordings } from './recordings/recovery'
import { registerRecordingIpc } from './recordings/ipc'
import { createRecordingService, type RecordingService } from './recordings/recording-service'

let db: Db | undefined
let recordings: RecordingService | undefined

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Renderer'daki mikrofon yakalama sayfa yenilenince, pencere kapanınca ya da renderer çökünce yok olur;
  // açık kalan Recording'ler düzgünce bitirilir (macOS'ta pencere kapanınca uygulama yaşamaya devam eder).
  mainWindow.webContents.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) recordings?.stopAll()
  })
  mainWindow.webContents.on('render-process-gone', () => recordings?.stopAll())
  mainWindow.on('closed', () => recordings?.stopAll())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  try {
    db = openDatabase(join(app.getPath('userData'), 'meetanalyzing.db'))
  } catch (error) {
    dialog.showErrorBox('Veritabanı açılamadı', String(error))
    app.quit()
    return
  }

  const recordingsDir = join(app.getPath('userData'), 'recordings')

  // Önceki oturum kayıt sırasında çöktüyse yarım kalan Recording'ler IPC açılmadan önce toparlanır.
  try {
    const recovered = recoverInterruptedRecordings({ db, recordingsDir })
    if (recovered.repaired + recovered.discarded + recovered.failed > 0) {
      console.log(
        `Yarım kalan kayıtlar: ${recovered.repaired} onarıldı, ${recovered.discarded} silindi, ${recovered.failed} işlenemedi.`
      )
    }
  } catch (error) {
    // Toparlama başarısız olsa da uygulama açılır; satır DB'de kaldığı için sonraki açılışta yeniden denenir.
    console.error('Yarım kalan kayıtlar toparlanamadı:', error)
  }

  // Uyku engeli sebepleri (kayıt, ileride transcription) tek bir güç modülünde toplanır.
  const power = createPowerGuard(powerSaveBlocker)
  recordings = createRecordingService({ db, recordingsDir, requestMicrophoneAccess, power })
  registerMeetingIpc(createMeetingService({ db, recordingsDir, activeRecordings: recordings }))
  registerRecordingIpc(recordings)

  // Renderer yalnızca mikrofon izni isteyebilir; kamera ve diğer izin istekleri reddedilir.
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback, details) => {
      const wantsVideo = 'mediaTypes' in details && details.mediaTypes?.includes('video')
      callback(permission === 'media' && !wantsVideo)
    }
  )

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  recordings?.stopAll()
  db?.close()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
