import { AUDIO_FORMAT, PCM_CHUNK_MS } from '@shared/audio'
import { floatToPcm16, peakLevel } from '@shared/pcm'
import workletUrl from './pcm-capture.worklet.ts?worker&url'
import type { AudioSourceHandlers } from './audio-source'

export interface PcmPipeline {
  /** Akışı kapatır; kalan sesi son bir parça olarak gönderdikten sonra çözülür. */
  stop: () => Promise<void>
}

const CHUNK_SAMPLES = (AUDIO_FORMAT.sampleRate * PCM_CHUNK_MS) / 1000
const FLUSH_TIMEOUT_MS = 1_000

// Bir MediaStream'i 16 kHz mono PCM parçalarına çevirir. Örnek hızı dönüşümü (ör. 48 kHz) ve stereo → mono
// indirgemesi AudioContext'in kendisinde yapılır: bağlam 16 kHz açılır, worklet girişi tek kanala indirger.
// Akışın sahipliği devralınır: hata olursa ya da durdurulunca track'ler kapatılır.
export async function startPcmPipeline(
  stream: MediaStream,
  handlers: Pick<AudioSourceHandlers, 'onChunk' | 'onLevel'>
): Promise<PcmPipeline> {
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
