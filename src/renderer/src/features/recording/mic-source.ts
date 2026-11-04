import type { AudioSource } from './audio-source'
import { openWithTimeout } from './open-stream'
import { startPcmPipeline, type PcmPipeline } from './pcm-pipeline'

function openMicrophone(): Promise<MediaStream> {
  return openWithTimeout(
    navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    }),
    'mikrofon'
  )
}

// Sistemin varsayılan mikrofonundan 16 kHz mono PCM üretir (ADR-0003). Tarayıcı ses işleme
// (yankı bastırma, gürültü bastırma, otomatik kazanç) kapalıdır: transcription kaynağa en yakın sesi ister.
export function createMicSource(): AudioSource {
  let pipeline: PcmPipeline | undefined
  let stopped = false

  return {
    async start(handlers) {
      const stream = await openMicrophone()
      pipeline = await startPcmPipeline(stream, handlers)
      // Mikrofon çıkarıldı ya da izin geri alındı: track kendiliğinden 'ended' olur. Elle `stop()` bu olayı üretmez.
      stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        if (!stopped) handlers.onEnded()
      })
    },
    async stop() {
      stopped = true
      await pipeline?.stop()
    }
  }
}
