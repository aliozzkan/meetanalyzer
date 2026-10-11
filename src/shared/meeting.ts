// Main, preload ve renderer'ın ortak kullandığı Meeting tipleri.
// Terimler ve durumlar: GLOSSARY.md, docs/meeting-lifecycle.md

import type { IpcResult } from './ipc-result'

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
  | 'recording-active'
  | 'invalid-transition'
  | 'approved-immutable'
  | 'invalid-input'
  | 'internal-error'

export type MeetingResult<T> = IpcResult<T, MeetingErrorCode>
