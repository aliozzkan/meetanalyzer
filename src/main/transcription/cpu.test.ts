import { describe, expect, it } from 'vitest'
import { windowsPerformanceCores } from './cpu'
import { whisperThreads } from './whisper-args'

describe('Windows whisper thread sayısı', () => {
  it('mantıksal çekirdeklerin dörtte biri, en az 2', () => {
    expect(whisperThreads(windowsPerformanceCores(8))).toBe(2)
    expect(whisperThreads(windowsPerformanceCores(16))).toBe(4)
    expect(whisperThreads(windowsPerformanceCores(4))).toBe(2)
  })

  it('tek çekirdekte de en az bir performans çekirdeği sayar', () => {
    expect(windowsPerformanceCores(1)).toBe(1)
  })
})
