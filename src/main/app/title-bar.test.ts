import { describe, expect, it } from 'vitest'
import { titleBarOptions, titleBarOverlay } from './title-bar'

describe('başlık çubuğu', () => {
  it('Windows: gizli başlık çubuğu ve header renginde pencere düğmeleri', () => {
    expect(titleBarOptions('win32', false)).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: { color: '#ffffff', symbolColor: '#0a0a0a', height: 43 }
    })
    expect(titleBarOptions('win32', true)).toMatchObject({
      titleBarOverlay: { color: '#0a0a0a', symbolColor: '#fafafa' }
    })
  })

  it('overlay header çizgisini örtmez (header 44 px)', () => {
    expect(titleBarOverlay(false).height).toBe(43)
  })

  it('macOS: trafik ışıkları header’ın soluna oturur', () => {
    expect(titleBarOptions('darwin', false)).toEqual({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 14 }
    })
  })

  it('Linux: native başlık çubuğu kalır', () => {
    expect(titleBarOptions('linux', false)).toEqual({})
  })
})
