import { describe, expect, it } from 'vitest'
import { formatElapsed } from './format-elapsed'

describe('kayıt süresi', () => {
  it('dakika:saniye olarak, tamamlanmamış saniye aşağı yuvarlanarak gösterilir', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(59_999)).toBe('00:59')
    expect(formatElapsed(754_000)).toBe('12:34')
  })

  it('bir saati geçen kayıtta dakikalar saymaya devam eder', () => {
    expect(formatElapsed(3_725_000)).toBe('62:05')
  })
})
