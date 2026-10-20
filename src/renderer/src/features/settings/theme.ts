import { THEMES, type Theme } from '@shared/settings'

const STORAGE_KEY = 'theme'

// Tema yalnızca arayüz tercihidir; saklanamazsa ya da okunamazsa Sistem teması kullanılır.
// `localStorage`'a erişmek bile hata fırlatabilir, bu yüzden storage bir getter ile alınır.
export function readStoredTheme(getStorage: () => Storage): Theme {
  try {
    const stored = getStorage().getItem(STORAGE_KEY)
    return THEMES.find((theme) => theme === stored) ?? 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(getStorage: () => Storage, theme: Theme): void {
  try {
    getStorage().setItem(STORAGE_KEY, theme)
  } catch {
    // saklanamazsa yalnızca bu oturum için geçerli
  }
}

export function isDarkTheme(theme: Theme, systemDark: boolean): boolean {
  return theme === 'system' ? systemDark : theme === 'dark'
}
