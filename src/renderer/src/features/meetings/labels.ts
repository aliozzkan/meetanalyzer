import type { Language, MeetingState } from '@shared/meeting'

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
