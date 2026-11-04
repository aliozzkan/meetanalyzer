import type { MicrophoneSelection } from '@shared/settings'
import type { AudioSource } from './audio-source'
import { openWithTimeout } from './open-stream'
import { startPcmPipeline, type PcmPipeline } from './pcm-pipeline'

/** Mikrofon, kullanıcının seçtiği cihazdan sistem varsayılanına geçti. */
export type MicFallback =
  /** Kayıt başlarken seçili cihaz bağlı değildi. */
  | { reason: 'not-found'; label: string }
  /** Kayıt sürerken kullanılan mikrofon koptu. */
  | { reason: 'disconnected' }

export interface MicSourceOptions {
  /** Seçili mikrofon; yoksa (`null`) sistem varsayılanı. */
  selection?: MicrophoneSelection | null
  /** Seçili cihaz yerine varsayılan mikrofon kullanıldığında kullanıcıya haber vermek için. */
  onFallback?: (event: MicFallback) => void
}

// Seçili cihaz yok: tarayıcı bu hatalardan biriyle reddeder. İzin reddi (`NotAllowedError`) bunlardan değildir.
function isDeviceMissing(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'OverconstrainedError' || error.name === 'NotFoundError')
  )
}

function openMicrophone(deviceId?: string): Promise<MediaStream> {
  return openWithTimeout(
    navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    }),
    'mikrofon'
  )
}

// Seçili cihazı açar; bağlı değilse sistem varsayılanına düşer. Diğer hatalar (izin, zaman aşımı) olduğu gibi iletilir.
async function openPreferred(
  selection: MicrophoneSelection | null | undefined
): Promise<{ stream: MediaStream; fellBackFrom?: string }> {
  if (!selection) return { stream: await openMicrophone() }
  try {
    return { stream: await openMicrophone(selection.deviceId) }
  } catch (error) {
    if (!isDeviceMissing(error)) throw error
    return { stream: await openMicrophone(), fellBackFrom: selection.label }
  }
}

// Seçili ya da sistemin varsayılan mikrofonundan 16 kHz mono PCM üretir (ADR-0003). Tarayıcı ses işleme
// (yankı bastırma, gürültü bastırma, otomatik kazanç) kapalıdır: transcription kaynağa en yakın sesi ister.
// Kayıt sürerken mikrofon koparsa Recording bitmez: kaynak varsayılan mikrofonu açar ve aynı hatta devam eder.
export function createMicSource(options: MicSourceOptions = {}): AudioSource {
  let pipeline: PcmPipeline | undefined
  let current: MediaStream | undefined
  let stopped = false

  return {
    async start(handlers) {
      const { stream, fellBackFrom } = await openPreferred(options.selection)
      pipeline = await startPcmPipeline(stream, handlers)
      current = stream
      if (fellBackFrom !== undefined) {
        options.onFallback?.({ reason: 'not-found', label: fellBackFrom })
      }

      // Mikrofon çıkarıldı ya da izin geri alındı: track kendiliğinden 'ended' olur. Elle `stop()` bu olayı üretmez.
      const watch = (watched: MediaStream): void => {
        watched.getAudioTracks()[0]?.addEventListener('ended', () => {
          if (stopped || watched !== current) return
          void recover()
        })
      }
      const recover = async (): Promise<void> => {
        let next: MediaStream
        try {
          next = await openMicrophone()
        } catch {
          // Varsayılan mikrofon da açılamadı (cihaz yok, izin geri alındı): Recording biter.
          if (!stopped) handlers.onEnded()
          return
        }
        if (stopped) {
          next.getTracks().forEach((track) => track.stop())
          return
        }
        current = next
        pipeline?.replaceStream(next)
        watch(next)
        handlers.onSwitched?.()
        options.onFallback?.({ reason: 'disconnected' })
      }
      watch(stream)
    },
    async stop() {
      stopped = true
      await pipeline?.stop()
    }
  }
}
