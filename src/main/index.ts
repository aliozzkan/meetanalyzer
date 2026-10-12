import { app, shell, BrowserWindow, dialog, powerSaveBlocker, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { openDatabase, type Db } from './db/database'
import { registerMeetingIpc } from './meetings/ipc'
import { createAppModelService, getModelPath } from './model/app-model'
import { createStateBroadcaster, registerModelIpc } from './model/ipc'
import { createMeetingService } from './meetings/meeting-service'
import { getWhisperPaths } from './whisper/paths'
import { SUSPECT_WORD_PLAYBACK_PADDING_MS, SUSPECT_WORD_THRESHOLD, WHISPER_NICE } from './config'
import { performanceCoreCount } from './transcription/cpu'
import { transcribeRecording } from './transcription/transcribe-recording'
import { registerTranscriptIpc } from './transcript/ipc'
import { createWordAudioReader } from './transcript/word-audio'
import { createTranscriptService } from './transcript/transcript-service'
import { createStatusBroadcaster, registerTranscriptionIpc } from './transcription/ipc'
import {
  createTranscriptionQueue,
  recoverInterruptedTranscriptions,
  type TranscriptionQueue
} from './transcription/transcription-queue'
import { whisperThreads } from './transcription/whisper-args'
import { createPowerGuard } from './power/power-guard'
import { requestMicrophoneAccess } from './recordings/microphone'
import { recoverInterruptedRecordings } from './recordings/recovery'
import { registerRecordingIpc } from './recordings/ipc'
import { createRecordingService, type RecordingService } from './recordings/recording-service'

let db: Db | undefined
let recordings: RecordingService | undefined
let transcriptions: TranscriptionQueue | undefined

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

  const database = db
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

  // Transcription sırasında kapanan Meeting'ler Closed'a döner; kuyruk temizlenir.
  try {
    const recovered = recoverInterruptedTranscriptions(db)
    if (recovered > 0)
      console.log(`Yarım kalan Transcription: ${recovered} Meeting Closed'a döndü.`)
  } catch (error) {
    console.error('Yarım kalan Transcription toparlanamadı:', error)
  }

  // Uyku engeli sebepleri (kayıt, ileride transcription) tek bir güç modülünde toplanır.
  const power = createPowerGuard(powerSaveBlocker)
  recordings = createRecordingService({ db, recordingsDir, requestMicrophoneAccess, power })

  // Transcription modeli: indirme yalnızca kullanıcı isteğiyle başlar (otomatik indirme yok).
  const modelsDir = join(app.getPath('userData'), 'models')
  const model = createAppModelService({ modelsDir, onState: createStateBroadcaster() })
  registerModelIpc(model)

  const whisperPaths = getWhisperPaths({
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    resourcesPath: process.resourcesPath
  })
  const meetings = createMeetingService({
    db,
    recordingsDir,
    activeRecordings: recordings,
    // Kuyruk Meeting servisine, Meeting servisi kuyruğa bağlıdır; döngü bu sarmalayıcıyla kırılır.
    activeTranscriptions: { cancelMeeting: (id) => transcriptions?.cancelMeeting(id) }
  })
  transcriptions = createTranscriptionQueue({
    db,
    meetings,
    power,
    isModelReady: () => model.getState().status === 'ready',
    onStatus: createStatusBroadcaster(),
    transcribe: ({ recordingId, language, onProgress, signal }) =>
      transcribeRecording({
        db: database,
        recordingsDir,
        recordingId,
        language,
        suspectThreshold: SUSPECT_WORD_THRESHOLD,
        whisper: {
          cliPath: whisperPaths.cli,
          modelPath: getModelPath(modelsDir),
          vadModelPath: whisperPaths.vadModel,
          threads: whisperThreads(performanceCoreCount()),
          nice: WHISPER_NICE
        },
        onProgress,
        signal
      })
  })
  registerMeetingIpc(meetings)
  registerRecordingIpc(recordings)
  registerTranscriptionIpc(transcriptions)
  registerTranscriptIpc(
    createTranscriptService({ db: database }),
    createWordAudioReader({
      db: database,
      recordingsDir,
      paddingMs: SUSPECT_WORD_PLAYBACK_PADDING_MS
    })
  )

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
  // Çalışan whisper yetim kalmasın; Meeting Transcribing kalır ve açılışta Closed'a döner.
  transcriptions?.shutdown()
  db?.close()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
