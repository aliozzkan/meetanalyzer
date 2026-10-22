import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ModelState } from '@shared/model'

export interface ModelApi {
  /** Henüz okunmadıysa null. */
  state: ModelState | null
  /** İndirmeyi başlatır ya da kaldığı yerden sürdürür (yalnızca kullanıcı isteğiyle çağrılmalı). */
  start: () => void
  cancel: () => void
  /** Modeli siler; reddedilirse nedeni toast'ta gösterilir. Başarılıysa true. */
  remove: () => Promise<boolean>
  /** Model dosyasını Finder'da (macOS dışında klasörde) gösterir. */
  showInFolder: () => void
}

export function useModel(): ModelApi {
  const [state, setState] = useState<ModelState | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.model
      .getState()
      .then((initial) => {
        if (!cancelled) setState((current) => current ?? initial)
      })
      .catch((error) => console.error('Model durumu okunamadı:', error))
    const unsubscribe = window.api.model.onState(setState)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const start = useCallback(() => {
    void window.api.model
      .start()
      .then(setState)
      .catch((error) => console.error('Model indirme başlatılamadı:', error))
  }, [])
  const cancel = useCallback(() => {
    void window.api.model.cancel()
  }, [])

  const remove = useCallback(async (): Promise<boolean> => {
    const result = await window.api.model.remove()
    if (!result.ok) {
      toast.error(result.message)
      return false
    }
    setState(result.value)
    return true
  }, [])
  const showInFolder = useCallback(() => {
    void window.api.model.showInFolder().then((error) => {
      if (error) toast.error(`Model klasörü açılamadı: ${error}`)
    })
  }, [])

  return { state, start, cancel, remove, showInFolder }
}
