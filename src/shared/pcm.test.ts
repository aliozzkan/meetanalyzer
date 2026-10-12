import { describe, expect, it } from 'vitest'
import { floatToPcm16, pcm16ToFloat, peakLevel } from './pcm'

describe('floatToPcm16', () => {
  it('[-1, 1] aralığını 16-bit işaretli tamsayıya çevirir; aralık dışını taşırmadan kırpar', () => {
    const pcm = floatToPcm16(new Float32Array([0, 1, -1, 0.5, -0.5, 2, -2]))

    expect([...pcm]).toEqual([0, 32767, -32768, 16384, -16384, 32767, -32768])
  })
})

describe('peakLevel', () => {
  it('örneklerin mutlak değerce en büyüğünü döndürür', () => {
    expect(peakLevel(new Float32Array([0.1, -0.5, 0.25]))).toBeCloseTo(0.5)
    expect(peakLevel(new Float32Array([]))).toBe(0)
  })
})

describe('pcm16ToFloat', () => {
  it('little-endian 16-bit örnekleri float aralığına çevirir', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x40, 0x00, 0x80, 0xff, 0x7f])

    expect(Array.from(pcm16ToFloat(bytes))).toEqual([0, 0.5, -1, 32767 / 32768])
  })

  it('ArrayBuffer ortasından başlayan (hizasız) görünümü doğru okur', () => {
    const buffer = new Uint8Array([9, 0x00, 0x40, 0x00, 0x80]).buffer
    const view = new Uint8Array(buffer, 1, 4)

    expect(Array.from(pcm16ToFloat(view))).toEqual([0.5, -1])
  })

  it('floatToPcm16 ile gidiş dönüşte örnekleri korur', () => {
    const samples = new Float32Array([0, 0.25, -0.5])
    const pcm = floatToPcm16(samples)
    const bytes = new Uint8Array(pcm.buffer)

    expect(Array.from(pcm16ToFloat(bytes))).toEqual([0, 0.25, -0.5])
  })
})
