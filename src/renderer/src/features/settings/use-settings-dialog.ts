import { useCallback, useState } from 'react'

export const SETTINGS_SECTIONS = ['general', 'model', 'about'] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export interface SettingsDialogApi {
  open: boolean
  section: SettingsSection
  setOpen: (open: boolean) => void
  setSection: (section: SettingsSection) => void
  /** Dialog'u verilen bölümde açar (ör. header'daki model göstergesi → Transcription Modeli). */
  openAt: (section: SettingsSection) => void
}

// Ayarlar dialog'u uygulama kabuğunda yaşar: footer'dan ve uygulama menüsündeki "Ayarlar…"dan (⌘,) son
// bakılan bölümde, header'daki model göstergesinden Transcription Modeli bölümünde açılır.
export function useSettingsDialog(): SettingsDialogApi {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<SettingsSection>('general')
  const openAt = useCallback((next: SettingsSection) => {
    setSection(next)
    setOpen(true)
  }, [])
  return { open, section, setOpen, setSection, openAt }
}
