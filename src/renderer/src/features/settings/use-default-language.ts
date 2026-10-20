import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_LANGUAGE, type Language } from '@shared/meeting'

export interface DefaultLanguageApi {
  language: Language
  /** Kayıtlı ayar okundu mu? Okunmadan önce `language` varsayılan Türkçe'dir. */
  loaded: boolean
  setLanguage: (language: Language) => Promise<void>
}

// Her yeni Meeting'e önerilen dil (GLOSSARY: Default Language). Okunamazsa varsayılan Türkçe kalır.
export function useDefaultLanguage(): DefaultLanguageApi {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.api.settings.getDefaultLanguage().then((result) => {
      if (cancelled) return
      if (result.ok) setLanguageState(result.value)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setLanguage = useCallback(async (next: Language): Promise<void> => {
    const result = await window.api.settings.setDefaultLanguage(next)
    if (result.ok) setLanguageState(next)
    else toast.error(result.message)
  }, [])

  return { language, loaded, setLanguage }
}
