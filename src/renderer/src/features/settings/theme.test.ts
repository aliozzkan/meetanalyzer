import { describe, expect, it } from 'vitest'
import { isDarkTheme, readStoredTheme, storeTheme } from './theme'

const unavailable = (): Storage => {
  throw new DOMException('localStorage kapalı', 'SecurityError')
}

// Storage arayüzünün testte kullanılan kısmı; tarayıcı yok (vitest node ortamında koşar).
function memoryStorage(initial: Record<string, string> = {}): () => Storage {
  const values = new Map(Object.entries(initial))
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value)
  } as Storage
  return () => storage
}

describe('tema tercihi', () => {
  it('localStorage erişilemezse Sistem teması kullanılır', () => {
    expect(readStoredTheme(unavailable)).toBe('system')
  })

  it('seçilen tema saklanır ve sonraki açılışta geri okunur', () => {
    const storage = memoryStorage()

    storeTheme(storage, 'dark')

    expect(readStoredTheme(storage)).toBe('dark')
  })

  it('saklanan değer tanınmıyorsa Sistem teması kullanılır', () => {
    expect(readStoredTheme(memoryStorage({ theme: 'sepia' }))).toBe('system')
  })

  it('localStorage erişilemese de tema seçimi hata vermez', () => {
    expect(() => storeTheme(unavailable, 'light')).not.toThrow()
  })
})

describe('koyu tema kararı', () => {
  it('Sistem seçiliyken işletim sisteminin temasını izler', () => {
    expect(isDarkTheme('system', true)).toBe(true)
    expect(isDarkTheme('system', false)).toBe(false)
  })

  it('Açık ya da Koyu seçimi işletim sisteminin temasından bağımsızdır', () => {
    expect(isDarkTheme('dark', false)).toBe(true)
    expect(isDarkTheme('light', true)).toBe(false)
  })
})
