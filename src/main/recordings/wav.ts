export const WAV_HEADER_BYTES = 44

export interface WavFormat {
  sampleRate: number
  channels: number
  bitsPerSample: number
}

// 44 baytlık kanonik PCM WAV header'ı (RIFF/WAVE, "fmt " + "data" chunk'ları), little-endian.
// Recording sürerken dataBytes bilinmez; dosya 0 ile açılır, bitince gerçek boyutla yeniden yazılır.
export function createWavHeader(format: WavFormat & { dataBytes: number }): Buffer {
  const { sampleRate, channels, bitsPerSample, dataBytes } = format
  const blockAlign = (channels * bitsPerSample) / 8

  const header = Buffer.alloc(WAV_HEADER_BYTES)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + dataBytes, 4)
  header.write('WAVE', 8, 'ascii')
  header.write('fmt ', 12, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * blockAlign, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(dataBytes, 40)
  return header
}
