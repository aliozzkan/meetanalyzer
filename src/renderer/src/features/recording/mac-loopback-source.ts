import { SYSTEM_AUDIO_PERMISSION_CHECK_MS } from '@shared/audio'
import { AudioPermissionError, type AudioSource } from './audio-source'
import { openWithTimeout } from './open-stream'
import { startPcmPipeline, type PcmPipeline } from './pcm-pipeline'

// Uygulamanın kendi sesi (ör. Suspect Word dinletmesi) kayda girmesin: `restrictOwnAudio` Chromium'un loopback
// kısıtıdır; tür tanımlarında yoktur. Bilinmeyen bir kısıt yok sayılır (Electron 45'te etkisi issue 01'de ölçülür).
// Tarayıcı ses işleme (yankı/gürültü bastırma, otomatik kazanç) kapalıdır, mikrofondaki gibi: issue 01 ölçümünde
// loopback track'i bunları varsayılan olarak açık bildirdi ve tepe seviyesi 1.0'ı aştı (kırpılma). Transcription
// kaynağa en yakın sesi ister.
const AUDIO_CONSTRAINTS = {
  restrictOwnAudio: true,
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false
} as MediaTrackConstraints

// Yalnızca ses isteği Chromium'da reddedilirse (TypeError) video da istenir ve video track'i hemen kapatılır.
// Main hiçbir zaman video kaynağı vermez (system-audio.ts), yani ekran görüntüsü alınmaz.
async function getSystemAudioStream(): Promise<MediaStream> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      audio: AUDIO_CONSTRAINTS,
      video: false
    })
  } catch (error) {
    if (!(error instanceof TypeError)) throw error
    stream = await navigator.mediaDevices.getDisplayMedia({ audio: AUDIO_CONSTRAINTS, video: true })
  }
  for (const video of stream.getVideoTracks()) {
    video.stop()
    stream.removeTrack(video)
  }
  return stream
}

function isDenied(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'NotFoundError')
  )
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

// macOS 14.2+: bilgisayarın tüm sistem sesini (uygulama hangi çıkış cihazına çalarsa çalsın) Electron'un loopback yakalamasıyla alır ve
// 16 kHz mono PCM'e çevirir (dönüşüm AudioContext'te, pcm-pipeline.ts).
// İzin önceden sorgulanamaz: izin yoksa akış hata vermeden açılır ama ses track'i hemen `ended` gelir; bu açılışta
// AudioPermissionError olur. Kayıt sırasında `ended` ise kopmadır (çıkış cihazı değişti, izin geri alındı) → onEnded.
export function createMacLoopbackSource(): AudioSource {
  let pipeline: PcmPipeline | undefined
  let stopped = false

  return {
    async start(handlers) {
      let stream: MediaStream
      try {
        stream = await openWithTimeout(getSystemAudioStream(), 'sistem sesi')
      } catch (error) {
        if (isDenied(error)) throw new AudioPermissionError('system')
        throw error
      }
      const track = stream.getAudioTracks()[0]
      await wait(SYSTEM_AUDIO_PERMISSION_CHECK_MS)
      if (!track || track.readyState === 'ended') {
        stream.getTracks().forEach((t) => t.stop())
        throw new AudioPermissionError('system')
      }
      pipeline = await startPcmPipeline(stream, handlers)
      track.addEventListener('ended', () => {
        if (!stopped) handlers.onEnded()
      })
    },
    async stop() {
      stopped = true
      await pipeline?.stop()
    }
  }
}
