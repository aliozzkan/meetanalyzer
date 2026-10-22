import type { Language, MeetingState } from '@shared/meeting'
import type { MeetingAction } from './allowed-actions'

// Kullanıcıya gösterilen etiketler; terimlerin kaynağı GLOSSARY.md
export const STATE_LABELS: Record<MeetingState, string> = {
  recording: 'Kayıtta',
  closed: 'Kapandı',
  transcribing: 'Metne dökülüyor',
  transcribed: 'Düzeltmeye hazır',
  approved: 'Onaylandı'
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  tr: 'Türkçe',
  en: 'English'
}

// Sidebar satır menüsü (spec: "Sidebar > Meeting listesi")
export const ACTION_LABELS: Record<MeetingAction, string> = {
  rename: 'Yeniden adlandır',
  close: 'Kapat',
  transcribe: 'Metne dök',
  remove: 'Sil'
}
