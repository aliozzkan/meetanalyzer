// Main, preload ve renderer'ın ortak kullandığı Meeting tipleri.
// Terimler ve durumlar: GLOSSARY.md, docs/meeting-lifecycle.md

import type { IpcResult } from './ipc-result'

export const LANGUAGES = ['tr', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

// docs/tuning.md → Varsayılan Language. Kullanıcı Default Language seçmediyse kullanılır (Ayarlar > Genel).
export const DEFAULT_LANGUAGE: Language = 'tr'

// Bu dilimde yaşam döngüsünün yalnızca Approved'a kadar olan kısmı vardır.
export const MEETING_STATES = [
  'recording',
  'closed',
  'transcribing',
  'transcribed',
  'approved'
] as const
export type MeetingState = (typeof MEETING_STATES)[number]

// GLOSSARY → Title. Main bu sınırı zorunlu kılar; renderer yalnızca girişi sınırlamak için kullanır.
export const TITLE_MAX_LENGTH = 120

/** Saklanacak Title: kırpılmış hâli, boşsa null. Uzunluğu main ayrıca denetler. */
export function normalizeTitle(title: string): string | null {
  const trimmed = title.trim()
  return trimmed === '' ? null : trimmed
}

export interface MeetingSummary {
  id: string
  /** Kullanıcının verdiği ad; yoksa arayüz Meeting'i tarih/saatiyle gösterir. */
  title: string | null
  language: Language
  state: MeetingState
  lastError: string | null
  createdAt: number
  closedAt: number | null
  approvedAt: number | null
  recordingCount: number
}

export type MeetingErrorCode =
  | 'not-found'
  | 'meeting-already-recording'
  | 'no-recordings'
  | 'recording-active'
  | 'invalid-transition'
  | 'approved-immutable'
  | 'invalid-input'
  | 'model-missing'
  | 'internal-error'

export type MeetingResult<T> = IpcResult<T, MeetingErrorCode>
