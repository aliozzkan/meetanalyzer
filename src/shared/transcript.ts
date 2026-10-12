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

/** Ekranda bir kelimenin nasıl gösterileceği: ham metin, Correction ya da silinmiş (üstü çizili ham metin). */
export type WordDisplay =
  | { kind: 'raw'; text: string }
  | { kind: 'corrected'; text: string }
  | { kind: 'deleted'; text: string }

export function wordDisplay(word: TranscriptWord): WordDisplay {
  if (word.corrected === null) return { kind: 'raw', text: word.text }
  if (word.corrected === '') return { kind: 'deleted', text: word.text }
  return { kind: 'corrected', text: word.corrected }
}

/** Henüz Correction yapılmamış Suspect Word sayısı. */
export function countUncorrected(transcript: Transcript): number {
  let count = 0
  for (const recording of transcript.recordings) {
    for (const segment of recording.segments) {
      for (const word of segment.words) if (word.isSuspect && word.corrected === null) count += 1
    }
  }
  return count
}
