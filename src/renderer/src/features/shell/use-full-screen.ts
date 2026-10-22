import { useEffect, useState } from 'react'

// Pencere tam ekranda mı (macOS'ta trafik ışıkları o zaman kaybolur). Önce abone olunur, sonra ilk değer
// okunur; aradaki olay kaçmaz.
export function useFullScreen(): boolean {
  const [fullScreen, setFullScreen] = useState(false)
  useEffect(() => {
    let active = true
    const unsubscribe = window.api.app.onFullScreenChange(setFullScreen)
    void window.api.app.isFullScreen().then((value) => {
      if (active) setFullScreen(value)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  return fullScreen
}
