import { describe, expect, it } from 'vitest'
import { createSilenceMonitor } from './silence-monitor'

// 10 sn boyunca eşik altında kalırsa uyarır; eşik 0.01
const options = { silenceMs: 10_000, peakThreshold: 0.01 }

describe('createSilenceMonitor', () => {
  it('süre dolmadan uyarmaz, dolunca uyarır', () => {
    const monitor = createSilenceMonitor(options)

    expect(monitor.feed(0, 9_999)).toBe(false)
    expect(monitor.feed(0, 1)).toBe(true)
  })

  it('ses gelince uyarı kalkar ve sayım baştan başlar', () => {
    const monitor = createSilenceMonitor(options)
    monitor.feed(0, 10_000)

    expect(monitor.feed(0.2, 100)).toBe(false)
    expect(monitor.feed(0, 9_000)).toBe(false)
    expect(monitor.feed(0, 1_000)).toBe(true)
  })

  it('eşiğin altındaki çok kısık ses sessizlik sayılır, eşiğe eşit ses sayılmaz', () => {
    const monitor = createSilenceMonitor(options)

    expect(monitor.feed(0.0099, 10_000)).toBe(true)
    expect(monitor.feed(0.01, 1)).toBe(false)
  })
})
