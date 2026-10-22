import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import {
  appEntryCount,
  historyAvailability,
  type HistoryAvailability,
  type NavigationPosition
} from './history-navigation'

export interface HistoryNavigation extends HistoryAvailability {
  back: () => void
  forward: () => void
}

// Geri/ileri: header'daki oklar ve ⌘[ / ⌘] aynı işi yapar (Electron'da tarayıcı gibi varsayılan geçmiş
// kısayolu yoktur). Her gezinmede konum değiştiği için okların durumu yeniden okunur.
export function useHistoryNavigation(): HistoryNavigation {
  const navigate = useNavigate()
  useLocation()
  const back = useCallback(() => void navigate(-1), [navigate])
  const forward = useCallback(() => void navigate(1), [navigate])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey || event.shiftKey) return
      // Türkçe Q klavyede '[' Option ile üretilir: karakter (key) ya da fiziksel tuş (code) eşleşmesi yeter.
      if (event.key === '[' || event.code === 'BracketLeft') {
        event.preventDefault()
        back()
      } else if (event.key === ']' || event.code === 'BracketRight') {
        event.preventDefault()
        forward()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [back, forward])

  const { state, length } = window.history
  return {
    ...historyAvailability(state, appEntryCount(state, length, navigationPosition())),
    back,
    forward
  }
}

interface NavigationApi {
  entries: () => unknown[]
  currentEntry: { index: number } | null
}

// Navigation API TypeScript'in DOM tiplerinde henüz yok.
function navigationPosition(): NavigationPosition | null {
  const navigation = (window as { navigation?: NavigationApi }).navigation
  if (!navigation?.currentEntry) return null
  return { entryCount: navigation.entries().length, currentIndex: navigation.currentEntry.index }
}
