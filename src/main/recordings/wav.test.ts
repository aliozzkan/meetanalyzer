import { describe, expect, it } from 'vitest'
import { createWavHeader } from './wav'

// RIFF/WAVE şemasından elle hesaplanmış, little-endian:
//   "RIFF" | chunkSize=36+32000 | "WAVE" | "fmt " | 16 | PCM=1 | kanal=1
//   | örnekleme=16000 | byteRate=32000 | blockAlign=2 | bit=16 | "data" | 32000
const HEADER_16K_MONO_16BIT_32000_BYTES = Buffer.from(
  '52494646' +
    '247d0000' +
    '57415645' +
    '666d7420' +
    '10000000' +
    '0100' +
    '0100' +
    '803e0000' +
    '007d0000' +
    '0200' +
    '1000' +
    '64617461' +
    '007d0000',
  'hex'
)

describe('createWavHeader', () => {
  it('16 kHz mono 16-bit için 44 baytlık geçerli RIFF/WAVE header üretir', () => {
    const header = createWavHeader({
      sampleRate: 16_000,
      channels: 1,
      bitsPerSample: 16,
      dataBytes: 32_000
    })

    expect(header.equals(HEADER_16K_MONO_16BIT_32000_BYTES)).toBe(true)
  })
})
