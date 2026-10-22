import { describe, expect, it } from 'vitest'
import { historyAvailability } from './history-navigation'

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
