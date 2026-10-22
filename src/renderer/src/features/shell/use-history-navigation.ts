import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { historyAvailability, type HistoryAvailability } from './history-navigation'

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

  return { ...historyAvailability(window.history.state, appEntryCount()), back, forward }
}

interface NavigationApi {
  entries: () => unknown[]
  currentEntry: { index: number } | null
}

// `history.length` uygulamadan önceki girişleri de sayar. Uygulamanın girişleri: router'ın sırası (`idx`) kadar
// geride, Navigation API'nin gösterdiği kadar ileride. Navigation API TypeScript'in DOM tiplerinde henüz yok.
function appEntryCount(): number {
  const navigation = (window as { navigation?: NavigationApi }).navigation
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  if (!navigation?.currentEntry || typeof idx !== 'number') return window.history.length
  const ahead = navigation.entries().length - 1 - navigation.currentEntry.index
  return idx + 1 + ahead
}
