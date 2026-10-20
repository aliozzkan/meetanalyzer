import type { Theme } from '@shared/settings'
import type { SettingsSection } from './use-settings-dialog'

export const THEME_LABELS: Record<Theme, string> = {
  system: 'Sistem',
  light: 'Açık',
  dark: 'Koyu'
}

export const SECTION_LABELS: Record<SettingsSection, string> = {
  general: 'Genel',
  about: 'Hakkında'
}
