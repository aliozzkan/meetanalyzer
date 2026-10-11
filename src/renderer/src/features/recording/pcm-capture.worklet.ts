// AudioWorkletGlobalScope'ta (ana iş parçacığı dışında) çalışır. Giriş örneklerini BLOCK_SAMPLES'lık
// bloklar halinde ana iş parçacığına gönderir. Kodlama ve parçalama mic-capture.ts'te yapılır.
export {}

declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor()
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void

const BLOCK_SAMPLES = 4096

class PcmCaptureProcessor extends AudioWorkletProcessor {
  private block = new Float32Array(BLOCK_SAMPLES)
  private filled = 0

  constructor() {
    super()
    // 'flush': henüz dolmamış son bloğu gönder, ardından 'flushed' ile bittiğini bildir.
    this.port.onmessage = (event: MessageEvent): void => {
      if (event.data !== 'flush') return
      if (this.filled > 0) this.port.postMessage(this.block.slice(0, this.filled))
      this.filled = 0
      this.port.postMessage('flushed')
    }
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel) return true

    let offset = 0
    while (offset < channel.length) {
      const count = Math.min(channel.length - offset, BLOCK_SAMPLES - this.filled)
      this.block.set(channel.subarray(offset, offset + count), this.filled)
      this.filled += count
      offset += count
      if (this.filled === BLOCK_SAMPLES) {
        this.port.postMessage(this.block, [this.block.buffer])
        this.block = new Float32Array(BLOCK_SAMPLES)
        this.filled = 0
      }
    }
    return true
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor)
