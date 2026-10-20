import { useState } from 'react'

// Transcription Modeli bölümü issue 07'de gelir.
export const SETTINGS_SECTIONS = ['general', 'about'] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export interface SettingsDialogApi {
  open: boolean
  section: SettingsSection
  setOpen: (open: boolean) => void
  setSection: (section: SettingsSection) => void
}

// Ayarlar dialog'u uygulama kabuğunda yaşar: footer'dan ve uygulama menüsündeki "Ayarlar…"dan (⌘,) açılır.
export function useSettingsDialog(): SettingsDialogApi {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<SettingsSection>('general')
  return { open, section, setOpen, setSection }
}
