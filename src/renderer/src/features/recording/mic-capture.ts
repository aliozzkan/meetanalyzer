import { AUDIO_FORMAT, PCM_CHUNK_MS } from '@shared/audio'
import { floatToPcm16, peakLevel } from '@shared/pcm'
import workletUrl from './pcm-capture.worklet.ts?worker&url'

export interface MicCaptureHandlers {
  /** PCM_CHUNK_MS'lik 16 kHz mono 16-bit little-endian PCM parçası. */
  onChunk: (pcm: Uint8Array) => void
  /** Her ses bloğu için tepe seviyesi (0..1) ve bloğun süresi. */
  onLevel: (peak: number, durationMs: number) => void
}

export interface MicCapture {
  /** Yakalamayı durdurur; kalan sesi son bir parça olarak gönderdikten sonra çözülür. */
  stop: () => Promise<void>
}

const CHUNK_SAMPLES = (AUDIO_FORMAT.sampleRate * PCM_CHUNK_MS) / 1000
const FLUSH_TIMEOUT_MS = 1_000
// Mikrofon açılışı (izin, cihaz) bu süre içinde tamamlanmazsa vazgeçilir; arayüz sonsuza dek beklemez.
const OPEN_TIMEOUT_MS = 15_000

async function openMicrophone(): Promise<MediaStream> {
  const opening = navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('mikrofon zamanında açılamadı')), OPEN_TIMEOUT_MS)
  })
  try {
    return await Promise.race([opening, timeout])
  } catch (error) {
    // Zaman aşımından sonra gelen akış açık kalmasın.
    void opening.then((late) => late.getTracks().forEach((track) => track.stop())).catch(() => {})
    throw error
  } finally {
    clearTimeout(timer)
  }
}

// Sistemin varsayılan mikrofonundan 16 kHz mono PCM üretir (ADR-0003). Tarayıcı ses işleme
// (yankı bastırma, gürültü bastırma, otomatik kazanç) kapalıdır: transcription kaynağa en yakın sesi ister.
export async function startMicCapture(handlers: MicCaptureHandlers): Promise<MicCapture> {
  const stream = await openMicrophone()
  let context: AudioContext | undefined
  let node: AudioWorkletNode

  const release = async (): Promise<void> => {
    stream.getTracks().forEach((track) => track.stop())
    await context?.close()
  }

  try {
    context = new AudioContext({ sampleRate: AUDIO_FORMAT.sampleRate })
    await context.audioWorklet.addModule(workletUrl)
    node = new AudioWorkletNode(context, 'pcm-capture', {
      channelCount: 1,
      channelCountMode: 'explicit',
      outputChannelCount: [1]
    })
  } catch (error) {
    await release()
    throw error
  }

  let pending: Int16Array[] = []
  let pendingSamples = 0

  const sendPending = (): void => {
    if (pendingSamples === 0) return
    const merged = new Int16Array(pendingSamples)
    let offset = 0
    for (const part of pending) {
      merged.set(part, offset)
      offset += part.length
    }
    pending = []
    pendingSamples = 0
    handlers.onChunk(new Uint8Array(merged.buffer))
  }

  let onFlushed: (() => void) | undefined
  node.port.onmessage = (event: MessageEvent<Float32Array | 'flushed'>): void => {
    if (event.data === 'flushed') {
      onFlushed?.()
      return
    }
    const block = event.data
    handlers.onLevel(peakLevel(block), (block.length / AUDIO_FORMAT.sampleRate) * 1000)
    const pcm = floatToPcm16(block)
    pending.push(pcm)
    pendingSamples += pcm.length
    if (pendingSamples >= CHUNK_SAMPLES) sendPending()
  }

  // İşlemci çıkışa sıfır yazar; hedefe bağlamak yalnızca ses grafiğinin işlenmesini sağlar (sessiz).
  context.createMediaStreamSource(stream).connect(node)
  node.connect(context.destination)

  return {
    async stop() {
      const flushed = new Promise<void>((resolve) => {
        onFlushed = resolve
        setTimeout(resolve, FLUSH_TIMEOUT_MS)
      })
      node.port.postMessage('flush')
      await flushed
      sendPending()
      node.port.onmessage = null
      await release()
    }
  }
}
