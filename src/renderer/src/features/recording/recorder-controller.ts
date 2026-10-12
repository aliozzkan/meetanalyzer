import { SILENT_MIC_PEAK_THRESHOLD, SILENT_MIC_WARNING_MS } from '@shared/audio'
import { createSilenceMonitor } from '@shared/silence-monitor'
import type { RecordingResult, RecordingSummary } from '@shared/recording'
import type { MicCapture, MicCaptureHandlers } from './mic-capture'

export type RecorderState = 'idle' | 'starting' | 'recording' | 'stopping'

export interface RecorderSnapshot {
  state: RecorderState
  /** Recording'in ait olduğu Meeting; `idle` iken null. */
  meetingId: string | null
  /** 0..1, son ses bloğunun tepe seviyesi. */
  level: number
  /** Kaydın şu ana kadarki süresi (alınan sese göre). */
  elapsedMs: number
  /** Eşik süresi boyunca sessizlik: mikrofon sessize alınmış ya da yanlış seçilmiş olabilir. */
  silent: boolean
  /** Mikrofon izni verilmediği için kayıt başlamayan Meeting; uyarı o Meeting'in ekranında gösterilir. */
  microphoneDeniedFor: string | null
}

/** Recorder şu an bu Meeting'in Recording'ini başlatıyor, alıyor ya da bitiriyor mu? */
export function isBusyWith(
  recorder: Pick<RecorderSnapshot, 'state' | 'meetingId'>,
  meetingId: string
): boolean {
  return recorder.state !== 'idle' && recorder.meetingId === meetingId
}

export interface RecorderDeps {
  recordings: {
    start: (meetingId: string) => Promise<RecordingResult<RecordingSummary>>
    append: (recordingId: string, pcm: Uint8Array) => Promise<RecordingResult<void>>
    stop: (recordingId: string) => Promise<RecordingResult<RecordingSummary>>
    discard: (recordingId: string) => Promise<RecordingResult<void>>
  }
  startMicCapture: (handlers: MicCaptureHandlers) => Promise<MicCapture>
  notifyError: (message: string) => void
  onRecordingsChanged: () => void
}

export interface RecorderController {
  getSnapshot: () => RecorderSnapshot
  subscribe: (listener: () => void) => () => void
  start: (meetingId: string) => Promise<void>
  stop: () => Promise<void>
  /** Meeting silinirken ya da uygulama kapanırken: Recording bitirilir, hata gösterilmez. */
  stopQuietly: () => Promise<void>
}

interface ActiveCapture {
  recordingId: string
  capture: MicCapture
  /** Parçalar sırayla gönderilir; durdururken hepsinin işlenmesi beklenir. */
  appends: Promise<unknown>
  /** Ana süreç bir parçayı reddetti (kayıt artık sürmüyor); hata yalnızca bir kez bildirilir. */
  failed: boolean
}

function isPermissionError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError'
}

const IDLE: RecorderSnapshot = {
  state: 'idle',
  meetingId: null,
  level: 0,
  elapsedMs: 0,
  silent: false,
  microphoneDeniedFor: null
}

// Uygulama ömrü boyunca yaşayan tek kayıt denetleyicisi. Ekranlar gelip gider; Recording yalnızca
// kullanıcı durdurunca, Meeting silinince ya da uygulama kapanınca biter.
export function createRecorderController(deps: RecorderDeps): RecorderController {
  let snapshot: RecorderSnapshot = IDLE
  const listeners = new Set<() => void>()
  let active: ActiveCapture | null = null
  /** Başlatma sürerken durdurma istendi: açılan yakalama hiç kayda dönüşmeden kapatılır. */
  let cancelRequested = false
  /** Süren durdurma; sonraki durdurma istekleri aynı işlemin bitmesini bekler. */
  let finishing: Promise<void> | null = null
  /** Süren başlatma; durdurma isteği (ör. Meeting silinirken) iptalin tamamlanmasını bekleyebilsin diye tutulur. */
  let starting: Promise<void> | null = null

  function update(patch: Partial<RecorderSnapshot>): void {
    snapshot = { ...snapshot, ...patch }
    listeners.forEach((listener) => listener())
  }

  async function runFinish(current: ActiveCapture, quiet: boolean): Promise<void> {
    update({ state: 'stopping' })
    try {
      // capture.stop() kalan sesi son bir parça olarak onChunk'a verir; ardından tüm append'ler beklenir.
      await current.capture.stop()
      await current.appends
    } finally {
      active = null
      // Yakalama düzgün kapanmasa bile ana süreçteki Recording bitirilir; aksi halde takılı kalır.
      const result = await deps.recordings.stop(current.recordingId)
      // Ana süreç kaydı zaten reddettiyse (ör. Meeting silindi) kullanıcı bunu bir kez görmüştür.
      if (!result.ok && !current.failed && !quiet) deps.notifyError(result.message)
      update({ ...IDLE })
      deps.onRecordingsChanged()
    }
  }

  // quiet: Meeting silinirken ya da uygulama kapanırken kullanıcıya hata gösterme.
  // Dönen söz Recording'in tamamen bitmesini (ya da başlatmanın iptal edilmesini) bekler; çağıran
  // (ör. Meeting silme) ancak o zaman güvenle devam eder.
  function finish(quiet = false): Promise<void> {
    if (finishing) return finishing
    const current = active
    if (!current) {
      if (snapshot.state !== 'starting') return Promise.resolve()
      cancelRequested = true
      return starting ?? Promise.resolve()
    }
    finishing = runFinish(current, quiet).finally(() => {
      finishing = null
    })
    return finishing
  }

  async function begin(meetingId: string): Promise<void> {
    cancelRequested = false
    update({ state: 'starting', meetingId, microphoneDeniedFor: null })
    const started = await deps.recordings.start(meetingId)
    if (!started.ok) {
      if (started.code === 'microphone-denied') update({ ...IDLE, microphoneDeniedFor: meetingId })
      else {
        deps.notifyError(started.message)
        update({ ...IDLE })
      }
      return
    }
    const recordingId = started.value.id
    if (cancelRequested) {
      await deps.recordings.discard(recordingId)
      update({ ...IDLE })
      return
    }
    const monitor = createSilenceMonitor({
      silenceMs: SILENT_MIC_WARNING_MS,
      peakThreshold: SILENT_MIC_PEAK_THRESHOLD
    })
    let elapsedMs = 0
    let capture: MicCapture
    try {
      capture = await deps.startMicCapture({
        onChunk: (pcm) => {
          const current = active
          if (!current) return
          current.appends = current.appends.then(async () => {
            if (current.failed) return
            const result = await deps.recordings.append(recordingId, pcm)
            // Kayıt artık yazılamıyor (Meeting silindi, disk hatası…): yakalamayı bırak ve kaydı bitir.
            if (!result.ok) {
              current.failed = true
              deps.notifyError(result.message)
              void finish(true)
            }
          })
        },
        onLevel: (peak, durationMs) => {
          elapsedMs += durationMs
          update({ level: peak, elapsedMs, silent: monitor.feed(peak, durationMs) })
        }
      })
    } catch (error) {
      // Mikrofon açılamadı (izin, cihaz yok, zaman aşımı): boş bir Recording bırakma.
      await deps.recordings.discard(recordingId)
      if (isPermissionError(error)) update({ ...IDLE, microphoneDeniedFor: meetingId })
      else {
        deps.notifyError(
          `Mikrofon açılamadı: ${error instanceof Error ? error.message : String(error)}`
        )
        update({ ...IDLE })
      }
      return
    }
    // Mikrofon açılırken kayıt iptal edildiyse hiçbir şey kaydedilmemiştir: boş bir Recording bırakma.
    if (cancelRequested) {
      await capture.stop()
      await deps.recordings.discard(recordingId)
      update({ ...IDLE })
      return
    }
    active = { recordingId, capture, appends: Promise.resolve(), failed: false }
    update({ state: 'recording' })
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async start(meetingId) {
      if (snapshot.state !== 'idle') return
      starting = begin(meetingId)
      try {
        await starting
      } finally {
        starting = null
      }
    },
    stop: () => finish(),
    stopQuietly: () => finish(true)
  }
}
