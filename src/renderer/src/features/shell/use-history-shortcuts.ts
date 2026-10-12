import { useEffect } from 'react'
import { useNavigate } from 'react-router'

// ⌘[ geri, ⌘] ileri (Electron'da tarayıcı gibi varsayılan geçmiş kısayolu yoktur).
export function useHistoryShortcuts(): void {
  const navigate = useNavigate()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.metaKey || event.shiftKey) return
      // Türkçe Q klavyede '[' Option ile üretilir: karakter (key) ya da fiziksel tuş (code) eşleşmesi yeter.
      if (event.key === '[' || event.code === 'BracketLeft') {
        event.preventDefault()
        void navigate(-1)
      } else if (event.key === ']' || event.code === 'BracketRight') {
        event.preventDefault()
        void navigate(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])
}
