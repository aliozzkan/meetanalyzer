import { describe, expect, it } from 'vitest'
import { floatToPcm16, peakLevel } from './pcm'

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
