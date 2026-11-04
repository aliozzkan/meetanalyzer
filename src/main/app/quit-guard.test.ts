import { describe, expect, it, vi } from 'vitest'
import { createQuitGuard, quitWarning } from './quit-guard'

const IDLE = { recording: false, transcribing: false }
const RECORDING = { recording: true, transcribing: false }
const TRANSCRIBING = { recording: false, transcribing: true }

describe('quitWarning', () => {
  it('hiçbir şey sürmüyorsa uyarı yok', () => {
    expect(quitWarning(IDLE)).toBeNull()
  })

  it('yalnızca Recording, yalnızca Transcription ve ikisi için ayrı metin', () => {
    expect(quitWarning(RECORDING)).toBe('Kapatırsan kayıt durur. Kaydedilen kısım korunur.')
    expect(quitWarning(TRANSCRIBING)).toMatch(/^Kapatırsan transcription iptal olur\./)
    expect(quitWarning({ recording: true, transcribing: true })).toBe(
      'Kapatırsan kayıt durur ve transcription iptal olur.'
    )
  })
})

describe('createQuitGuard', () => {
  it('hiçbir şey sürmüyorsa sormadan izin verir', () => {
    const confirm = vi.fn(() => true)
    expect(createQuitGuard(confirm).allow(IDLE, true)).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('"Vazgeç" kapatmayı durdurur ve sonraki denemede yine sorar', () => {
    const confirm = vi.fn(() => false)
    const guard = createQuitGuard(confirm)
    expect(guard.allow(RECORDING, true)).toBe(false)
    expect(guard.allow(RECORDING, true)).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('çıkış onaylanınca aynı çıkışta bir daha sorulmaz (pencere close → before-quit)', () => {
    const confirm = vi.fn(() => true)
    const guard = createQuitGuard(confirm)
    expect(guard.allow(RECORDING, true)).toBe(true)
    expect(guard.allow(RECORDING, true)).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('macOS: yalnızca pencere kapanırken verilen onay sonraki çıkışa sayılmaz', () => {
    const confirm = vi.fn(() => true)
    const guard = createQuitGuard(confirm)
    expect(guard.allow(RECORDING, false)).toBe(true)
    expect(guard.allow(TRANSCRIBING, true)).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(2)
  })
})
