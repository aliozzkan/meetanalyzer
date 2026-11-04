import {
  AUDIO_CHANNELS,
  SILENT_MIC_PEAK_THRESHOLD,
  SILENT_MIC_WARNING_MS,
  type AudioChannel
} from '@shared/audio'
import {
  createMeetingAudioTracker,
  isMeetingSilent,
  type MeetingAudioTracker
} from '@shared/meeting-silence'
import { createSilenceMonitor } from '@shared/silence-monitor'
import type { RecordingResult, RecordingSummary } from '@shared/recording'
import { AudioPermissionError, type AudioSource, type AudioSourceHandlers } from './audio-source'

export type RecorderState = 'idle' | 'starting' | 'recording' | 'stopping'

export interface RecorderSnapshot {
  state: RecorderState
  /** Recording'in ait olduğu Meeting; `idle` iken null. */
  meetingId: string | null
  /** 0..1, mikrofonun ("Sen") son ses bloğunun tepe seviyesi. */
  level: number
  /** 0..1, sistem sesinin ("Toplantı") son ses bloğunun tepe seviyesi. */
  systemLevel: number
  /** Kaydın şu ana kadarki süresi (alınan sese göre). */
  elapsedMs: number
  /** Eşik süresi boyunca sessizlik: mikrofon sessize alınmış ya da yanlış seçilmiş olabilir. */
  silent: boolean
  /** Mikrofon izni verilmediği için kayıt başlamayan Meeting; uyarı o Meeting'in ekranında gösterilir. */
  microphoneDeniedFor: string | null
  /** Sistem sesi kaydı bilgilendirmesi kabul edilmediği için kayıt başlamayan Meeting. */
  consentRequiredFor: string | null
  /** Sistem sesi izni verilmediği için kayıt başlamayan Meeting (macOS Ses Kaydı izni). */
  systemAudioDeniedFor: string | null
  /** Mikrofonda konuşma olduğu halde sistem kanalı baştan sona sessiz kalan, az önce biten Recording'in Meeting'i. */
  quietMeetingFor: string | null
  /** Kayıt sürerken bir kaynak kesildiği için kendiliğinden biten Recording'in Meeting'i ve kesilen kanal. */
  interrupted: { meetingId: string; channel: AudioChannel } | null
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
    append: (
      recordingId: string,
      pcm: Uint8Array,
      channel: AudioChannel
    ) => Promise<RecordingResult<void>>
    stop: (recordingId: string) => Promise<RecordingResult<RecordingSummary>>
    discard: (recordingId: string) => Promise<RecordingResult<void>>
  }
  /** Bir Recording'in kanal kaynakları; her Recording için yeniden kurulur (kaynaklar tek kullanımlıktır). */
  createSources: () => Partial<Record<AudioChannel, AudioSource>>
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
  /** Başarıyla açılmış kaynaklar; durdururken hepsi kapatılır. */
  sources: AudioSource[]
  /** Tüm kaynaklar açıldı: bundan önce gelen parçalar atılır ki kanallar aynı anda başlasın. */
  live: boolean
  /** Parçalar sırayla gönderilir; durdururken hepsinin işlenmesi beklenir. */
  appends: Promise<unknown>
  /** Ana süreç bir parçayı reddetti (kayıt artık sürmüyor); hata yalnızca bir kez bildirilir. */
  failed: boolean
  /** Recording'in sistem sesi kanalı var mı; yoksa "toplantı sesi duyulmadı" kararı verilmez. */
  expectsSystem: boolean
  /** Mikrofon ve sistem sesinin seviyelerinden "toplantı sesi duyulmadı" kararı Recording bitince verilir. */
  audio: MeetingAudioTracker
  /** Kayıt sürerken kopan ilk kanal; Recording kendiliğinden bittiğinde arayüze iletilir. */
  interruptedBy: AudioChannel | null
}

// Hangi kanalın izni yok? Kaynaklar `AudioPermissionError` verir; tarayıcının `NotAllowedError`'u açılan kanala yazılır.
function deniedChannel(error: unknown, openedChannel: AudioChannel): AudioChannel | null {
  if (error instanceof AudioPermissionError) return error.channel
  if (error instanceof DOMException && error.name === 'NotAllowedError') return openedChannel
  return null
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const CHANNEL_LABEL: Record<AudioChannel, string> = {
  mic: 'Mikrofon',
  system: 'Sistem sesi'
}

const IDLE: RecorderSnapshot = {
  state: 'idle',
  meetingId: null,
  level: 0,
  systemLevel: 0,
  elapsedMs: 0,
  silent: false,
  microphoneDeniedFor: null,
  systemAudioDeniedFor: null,
  consentRequiredFor: null,
  quietMeetingFor: null,
  interrupted: null
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
    const meetingId = snapshot.meetingId
    update({ state: 'stopping' })
    try {
      // Her kaynak kalan sesini son bir parça olarak onChunk'a verir; ardından tüm append'ler beklenir.
      await Promise.all(current.sources.map((source) => source.stop()))
      await current.appends
    } finally {
      active = null
      // Yakalama düzgün kapanmasa bile ana süreçteki Recording bitirilir; aksi halde takılı kalır.
      const result = await deps.recordings.stop(current.recordingId)
      // Ana süreç kaydı zaten reddettiyse (ör. Meeting silindi) kullanıcı bunu bir kez görmüştür.
      if (!result.ok && !current.failed && !quiet) deps.notifyError(result.message)
      update({
        ...IDLE,
        interrupted:
          current.interruptedBy && meetingId ? { meetingId, channel: current.interruptedBy } : null,
        // Yalnızca kullanıcı durdurduysa ya da kayıt kendiliğinden bittiyse değerlendirilir; kopmada sebep zaten bellidir.
        quietMeetingFor:
          meetingId &&
          current.expectsSystem &&
          !current.interruptedBy &&
          isMeetingSilent(current.audio.summary())
            ? meetingId
            : null
      })
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
    update({
      state: 'starting',
      meetingId,
      microphoneDeniedFor: null,
      systemAudioDeniedFor: null,
      consentRequiredFor: null,
      quietMeetingFor: null,
      interrupted: null
    })
    const started = await deps.recordings.start(meetingId)
    if (!started.ok) {
      if (started.code === 'microphone-denied') update({ ...IDLE, microphoneDeniedFor: meetingId })
      else if (started.code === 'system-audio-consent-required')
        update({ ...IDLE, consentRequiredFor: meetingId })
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
    const elapsedByChannel: Partial<Record<AudioChannel, number>> = {}
    // Kaynaklar açılırken de parçalar gelebilir; capture önceden kurulur, `live` olana kadar parçalar atılır.
    const capture: ActiveCapture = {
      recordingId,
      sources: [],
      live: false,
      appends: Promise.resolve(),
      failed: false,
      audio: createMeetingAudioTracker(),
      interruptedBy: null,
      expectsSystem: false
    }
    const sources = deps.createSources()
    capture.expectsSystem = Boolean(sources.system)

    const handlersFor = (channel: AudioChannel): AudioSourceHandlers => ({
      onChunk: (pcm) => {
        if (!capture.live) return
        capture.appends = capture.appends.then(async () => {
          if (capture.failed) return
          const result = await deps.recordings.append(recordingId, pcm, channel)
          // Kayıt artık yazılamıyor (Meeting silindi, disk hatası…): yakalamayı bırak ve kaydı bitir.
          if (!result.ok) {
            capture.failed = true
            deps.notifyError(result.message)
            void finish(true)
          }
        })
      },
      onLevel: (peak, durationMs) => {
        if (!capture.live) return
        capture.audio.feed(channel, peak, durationMs)
        elapsedByChannel[channel] = (elapsedByChannel[channel] ?? 0) + durationMs
        const elapsedMs = Math.max(...Object.values(elapsedByChannel))
        if (channel === 'mic')
          update({ level: peak, elapsedMs, silent: monitor.feed(peak, durationMs) })
        else update({ systemLevel: peak, elapsedMs })
      },
      onEnded: () => {
        // Kullanıcı ya da önceki bir kopma zaten durdurduysa yok sayılır.
        if (active !== capture || finishing) return
        capture.interruptedBy ??= channel
        void finish(true)
      }
    })

    let failedChannel: AudioChannel = 'mic'
    try {
      for (const channel of AUDIO_CHANNELS) {
        const source = sources[channel]
        if (!source) continue
        failedChannel = channel
        await source.start(handlersFor(channel))
        capture.sources.push(source)
      }
    } catch (error) {
      // Bir kaynak açılamadı (izin, cihaz yok, zaman aşımı): açılanlar kapatılır, boş Recording bırakılmaz.
      await Promise.allSettled(capture.sources.map((source) => source.stop()))
      await capture.appends
      await deps.recordings.discard(recordingId)
      const denied = deniedChannel(error, failedChannel)
      if (denied === 'mic') update({ ...IDLE, microphoneDeniedFor: meetingId })
      else if (denied === 'system') update({ ...IDLE, systemAudioDeniedFor: meetingId })
      else {
        deps.notifyError(`${CHANNEL_LABEL[failedChannel]} açılamadı: ${describeError(error)}`)
        update({ ...IDLE })
      }
      return
    }
    // Kaynaklar açılırken kayıt iptal edildiyse hiçbir şey kaydedilmemiştir: boş bir Recording bırakma.
    if (cancelRequested) {
      await Promise.all(capture.sources.map((source) => source.stop()))
      await deps.recordings.discard(recordingId)
      update({ ...IDLE })
      return
    }
    capture.live = true
    active = capture
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
