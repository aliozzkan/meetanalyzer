import { describe, expect, it } from 'vitest'
import {
  appEntryCount,
  historyAvailability,
  historyShortcut,
  historyShortcutLabel,
  type HistoryKey
} from './history-navigation'

// `state`, react-router'ın hash history'sinin `window.history.state`'e yazdığı kayıttır ({ usr, key, idx }).
describe('geri/ileri okları', () => {
  it('uygulama ilk açıldığında gidilecek yer yoktur', () => {
    expect(historyAvailability({ usr: null, key: 'default', idx: 0 }, 1)).toEqual({
      canGoBack: false,
      canGoForward: false
    })
  })

  it('iki ekran gezildikten sonra geri gidilebilir, ileri gidilemez', () => {
    expect(historyAvailability({ usr: null, key: 'b', idx: 2 }, 3)).toEqual({
      canGoBack: true,
      canGoForward: false
    })
  })

  it('geri gelindiğinde ileri gidilebilir', () => {
    expect(historyAvailability({ usr: null, key: 'a', idx: 1 }, 3)).toEqual({
      canGoBack: true,
      canGoForward: true
    })
  })

  it('ilk ekrana kadar geri gelindiğinde yalnızca ileri gidilebilir', () => {
    expect(historyAvailability({ usr: null, key: 'default', idx: 0 }, 3)).toEqual({
      canGoBack: false,
      canGoForward: true
    })
  })

  it('router henüz konumunu yazmadıysa iki ok da kapalıdır', () => {
    expect(historyAvailability(null, 2)).toEqual({ canGoBack: false, canGoForward: false })
  })
})

// Electron penceresinin geçmişinde uygulamadan önce girişler olabilir (ör. ilk yükleme); oklar yalnızca
// uygulamanın girişlerini saymalı.
describe('uygulamanın geçmiş girişi sayısı', () => {
  it('router sırası kadar geride, Navigation API konumu kadar ileride giriş sayılır', () => {
    // 4 girişin ilki uygulamadan önce; uygulamada 2. ekrandayız, 1 ileri giriş var.
    expect(appEntryCount({ idx: 1 }, 4, { entryCount: 4, currentIndex: 2 })).toBe(3)
  })

  it('ileri giriş yoksa sayı router sırasının bir fazlasıdır', () => {
    expect(appEntryCount({ idx: 2 }, 5, { entryCount: 5, currentIndex: 4 })).toBe(3)
  })

  it('Navigation API yoksa tarayıcının geçmiş uzunluğu kullanılır', () => {
    expect(appEntryCount({ idx: 1 }, 4, null)).toBe(4)
  })

  it('router henüz konumunu yazmadıysa tarayıcının geçmiş uzunluğu kullanılır', () => {
    expect(appEntryCount(null, 4, { entryCount: 4, currentIndex: 3 })).toBe(4)
  })
})

describe('geri/ileri kısayolu', () => {
  const key = (overrides: Partial<HistoryKey>): HistoryKey => ({
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides
  })

  it('macOS: ⌘[ geri, ⌘] ileri; Türkçe klavyede fiziksel tuş da eşleşir', () => {
    expect(historyShortcut(key({ metaKey: true, key: '[' }), true)).toBe('back')
    expect(historyShortcut(key({ metaKey: true, key: '"', code: 'BracketRight' }), true)).toBe(
      'forward'
    )
    expect(historyShortcut(key({ altKey: true, key: 'ArrowLeft' }), true)).toBeNull()
  })

  it('Windows: Alt+← geri, Alt+→ ileri; başka değiştirici varsa yok sayılır', () => {
    expect(historyShortcut(key({ altKey: true, key: 'ArrowLeft' }), false)).toBe('back')
    expect(historyShortcut(key({ altKey: true, key: 'ArrowRight' }), false)).toBe('forward')
    expect(
      historyShortcut(key({ altKey: true, ctrlKey: true, key: 'ArrowLeft' }), false)
    ).toBeNull()
    expect(historyShortcut(key({ metaKey: true, key: '[' }), false)).toBeNull()
  })

  it('ipucu platformun kısayolunu gösterir', () => {
    expect(historyShortcutLabel('back', true)).toBe('⌘[')
    expect(historyShortcutLabel('forward', false)).toBe('Alt+→')
  })
})
