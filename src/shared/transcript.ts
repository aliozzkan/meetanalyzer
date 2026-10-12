// Main, preload ve renderer'ın ortak kullandığı Transcript (Correction ekranı) tipleri.
// Terimler: GLOSSARY.md → Transcript, Suspect Word, Correction

import type { IpcResult } from './ipc-result'

export interface TranscriptWord {
  id: string
  /** Transcription'ın ürettiği ham metin; Correction bunu değiştirmez. */
  text: string
  isSuspect: boolean
  /** Kullanıcının Correction'ı; boş string kelimenin silindiği anlamına gelir. Yoksa null. */
  corrected: string | null
}

export interface TranscriptSegment {
  id: string
  words: TranscriptWord[]
}

export interface TranscriptRecording {
  id: string
  segments: TranscriptSegment[]
}

/** Recording sırasıyla; Recording sınırları arayüzde ayraçla gösterilir. */
export interface Transcript {
  meetingId: string
  recordings: TranscriptRecording[]
}

export type TranscriptErrorCode =
  | 'meeting-not-found'
  | 'word-not-found'
  | 'not-suspect'
  | 'not-correctable' // Meeting Transcribed değil (ör. Approved: Transcript dondurulmuştur)
  | 'not-transcribed' // Meeting'in Transcript'i henüz yok
  | 'invalid-input'
  | 'internal-error'

export type TranscriptResult<T> = IpcResult<T, TranscriptErrorCode>
