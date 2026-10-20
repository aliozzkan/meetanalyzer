import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_LANGUAGE, type Language } from '@shared/meeting'

export interface DefaultLanguageApi {
  language: Language
  setLanguage: (language: Language) => Promise<void>
}

// Her yeni Meeting'e önerilen dil (GLOSSARY: Default Language). Okunamazsa varsayılan Türkçe kalır.
export function useDefaultLanguage(): DefaultLanguageApi {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE)

  useEffect(() => {
    let cancelled = false
    void window.api.settings.getDefaultLanguage().then((result) => {
      if (!cancelled && result.ok) setLanguageState(result.value)
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

  return { language, setLanguage }
}
