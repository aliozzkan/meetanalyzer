// Main, preload ve renderer'ın ortak kullandığı Meeting tipleri.
// Terimler ve durumlar: GLOSSARY.md, docs/meeting-lifecycle.md

export const LANGUAGES = ['tr', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

// docs/tuning.md → Varsayılan Language. Default Language ayarı gelene kadar sabittir (backlog 08).
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

export interface MeetingSummary {
  id: string
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
  | 'invalid-transition'
  | 'approved-immutable'
  | 'invalid-input'
  | 'internal-error'

// IPC üzerinden hata fırlatılınca `code` kaybolduğu için servis hataları sonuç olarak döner.
export type MeetingResult<T> =
  { ok: true; value: T } | { ok: false; code: MeetingErrorCode; message: string }
