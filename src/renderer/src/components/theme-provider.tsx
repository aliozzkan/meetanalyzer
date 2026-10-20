import { useEffect, useState } from 'react'
import type { Theme } from '@shared/settings'
import { isDarkTheme, readStoredTheme, storeTheme } from '../features/settings/theme'
import { ThemeContext } from '../features/settings/use-theme'

const getStorage = (): Storage => window.localStorage

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(getStorage))

  // Main'deki `nativeTheme.themeSource` da güncellenir: native menüler, scrollbar ve dialog'lar uyar.
  // Electron'da bu, renderer'ın `prefers-color-scheme` sorgusunu da seçilen temaya çeker.
  useEffect(() => {
    void window.api.settings.setTheme(theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      document.documentElement.classList.toggle('dark', isDarkTheme(theme, media.matches))
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const setTheme = (next: Theme): void => {
    storeTheme(getStorage, next)
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
