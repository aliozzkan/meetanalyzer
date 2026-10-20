import { createContext, useContext } from 'react'
import type { Theme } from '@shared/settings'

export interface ThemeApi {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeApi | null>(null)

// Sidebar footer'ındaki tema menüsü ile Ayarlar > Genel aynı değeri buradan okur ve değiştirir.
export function useTheme(): ThemeApi {
  const api = useContext(ThemeContext)
  if (!api) throw new Error('useTheme, ThemeProvider içinde kullanılmalı')
  return api
}
