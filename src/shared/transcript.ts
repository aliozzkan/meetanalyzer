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

/** Konuşanın tarafı: `self` kullanıcının mikrofonu ("Sen"), `others` sistem sesi ("Diğerleri"). */
export type Side = 'self' | 'others'

export const SIDE_LABEL: Record<Side, string> = { self: 'Sen', others: 'Diğerleri' }

export interface TranscriptSegment {
  id: string
  side: Side
  words: TranscriptWord[]
}

/** Ardışık, aynı Side'lı segmentler: Correction ekranında ve Approved Transcript'te bir blok. */
export interface TranscriptBlock {
  side: Side
  segments: TranscriptSegment[]
}

/** Segmentleri (zamana göre sıralı) ardışık aynı Side'lı bloklara toplar. */
export function groupIntoBlocks(segments: TranscriptSegment[]): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = []
  for (const segment of segments) {
    const last = blocks.at(-1)
    if (last?.side === segment.side) last.segments.push(segment)
    else blocks.push({ side: segment.side, segments: [segment] })
  }
  return blocks
}

export interface TranscriptRecording {
  id: string
  segments: TranscriptSegment[]
}

/**
 * Recording sırasıyla; Recording sınırları arayüzde ayraçla gösterilir. Her Recording'in segmentleri iki kanalın
 * birleşimidir ve başlangıç zamanına göre sıralıdır; yankı sayılan kelimeler dahil değildir (ADR-0007).
 */
export interface Transcript {
  meetingId: string
  recordings: TranscriptRecording[]
}

export type TranscriptErrorCode =
  | 'meeting-not-found'
  | 'word-not-found'
  | 'not-suspect'
  | 'not-correctable' // Meeting Transcribed değil (ör. Approved: Transcript dondurulmuştur)
  | 'audio-missing' // ses dosyası yok (ör. Approve sonrası silinmiş)
  | 'not-approvable' // yalnızca Transcribed Meeting onaylanabilir
  | 'not-approved' // Meeting'in Approved Transcript'i yok
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

/** Bir Suspect Word çevresinden kesilmiş mono 16-bit little-endian PCM. */
export interface WordAudio {
  pcm: Uint8Array
  sampleRate: number
}

/** Approved Transcript'in bir bloğu: kelimeler Correction'larıyla birleşmiş, tek paragraf metin. */
export interface ApprovedBlock {
  side: Side
  text: string
}

/** Dondurulmuş Approved Transcript: sıralı Side blokları ve bunların düz metin görünümü ("Sen: …" / "Diğerleri: …"). */
export interface ApprovedTranscript {
  blocks: ApprovedBlock[]
  text: string
}

// Approved Transcript blokları: her Recording'in segmentleri ardışık aynı Side'lı bloklara toplanır; her blok
// kelimelerini Correction varsa onun metniyle yazar (boş Correction kelimeyi düşürür), boşluklar tek boşluğa indirilir.
// Recording sınırları korunur (bir Recording'in son bloğu sonrakinin ilk bloğuyla birleşmez); tamamen silinen blok düşer.
export function composeApprovedBlocks(transcript: Transcript): ApprovedBlock[] {
  return transcript.recordings.flatMap((recording) =>
    groupIntoBlocks(recording.segments)
      .map((block) => ({
        side: block.side,
        text: block.segments
          .flatMap((segment) => segment.words.map((word) => word.corrected ?? word.text))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      }))
      .filter((block) => block.text !== '')
  )
}

/** Blokların düz metin görünümü: her blok "Sen: …" ya da "Diğerleri: …", bloklar boş satırla ayrılır. */
export function formatApprovedBlocks(blocks: ApprovedBlock[]): string {
  return blocks.map((block) => `${SIDE_LABEL[block.side]}: ${block.text}`).join('\n\n')
}

export function composeApprovedText(transcript: Transcript): string {
  return formatApprovedBlocks(composeApprovedBlocks(transcript))
}
