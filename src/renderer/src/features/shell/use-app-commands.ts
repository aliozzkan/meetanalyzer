import { useEffect, useRef } from 'react'
import type { AppCommand } from '@shared/app'

// Uygulama menüsünden gelen komutları (⌘,, ⌘N) işler. Pencere kapalıyken seçilen komut, pencere açılınca
// bir kez alınır. İşleyiciler her render'da değişebilir; abonelik bir kez kurulur, son işleyici çağrılır.
export function useAppCommands(handlers: Record<AppCommand, () => void>): void {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    const run = (command: AppCommand): void => latest.current[command]()
    const unsubscribe = window.api.app.onCommand(run)
    void window.api.app.takePendingCommand().then((command) => {
      if (command) run(command)
    })
    return unsubscribe
  }, [])
}
