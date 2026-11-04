import type { Language, MeetingState } from '../../shared/meeting'
import type { AudioChannel } from '../../shared/audio'
import type {
  Side,
  Transcript,
  TranscriptErrorCode,
  TranscriptRecording,
  TranscriptSegment
} from '../../shared/transcript'
import {
  ECHO_MIN_RUN,
  ECHO_SEGMENT_MIN_ECHOES,
  ECHO_SEGMENT_MIN_RATIO,
  ECHO_WINDOW_MS
} from '../config'
import type { Db } from '../db/database'
import { dropIsolatedEchoes, expandEchoesBySegment, findEchoWordIds } from './echo'

export class TranscriptError extends Error {
  constructor(
    readonly code: TranscriptErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'TranscriptError'
  }
}

export interface TranscriptService {
  get: (meetingId: string) => Transcript
  /** Suspect Word'ün yerine geçen metni kaydeder (word başına tek satır); boş metin kelimeyi siler.
   * Kenar boşlukları kırpılır; saklanan (kırpılmış) metin döner. */
  correct: (wordId: string, corrected: string) => string
  /** Correction'ı kaldırır; kelime ham metnine döner. */
  revert: (wordId: string) => void
}

interface MeetingRow {
  state: MeetingState
}

interface WordContext {
  text: string
  is_suspect: number
  state: MeetingState
  language: Language
}

interface TranscriptRow {
  recording_id: string
  segment_id: string
  channel: AudioChannel
  segment_start_ms: number
  word_id: string
  text: string
  word_start_ms: number
  is_suspect: number
  corrected: string | null
}

const SIDE: Record<AudioChannel, Side> = { mic: 'self', system: 'others' }

interface SegmentDraft {
  id: string
  channel: AudioChannel
  startMs: number
  words: (TranscriptSegment['words'][number] & { startMs: number })[]
}

export function createTranscriptService({
  db,
  now = Date.now
}: {
  db: Db
  now?: () => number
}): TranscriptService {
  function get(meetingId: string): Transcript {
    const meeting = db.prepare('SELECT state FROM meetings WHERE id = ?').get(meetingId) as
      MeetingRow | undefined
    if (!meeting) throw new TranscriptError('meeting-not-found', 'Meeting bulunamadı.')
    if (meeting.state !== 'transcribed' && meeting.state !== 'approved') {
      throw new TranscriptError('not-transcribed', 'Bu Meeting’in Transcript’i henüz hazır değil.')
    }

    // Tek sorgu: Recording → segment → kelime sırasıyla; 1 saatlik toplantı ~10k satırdır.
    const rows = db
      .prepare(
        `SELECT r.id AS recording_id, s.id AS segment_id, s.channel, s.start_ms AS segment_start_ms,
                w.id AS word_id, w.text, w.start_ms AS word_start_ms, w.is_suspect, c.corrected
         FROM recordings r
         JOIN segments s ON s.recording_id = r.id
         JOIN words w ON w.segment_id = s.id
         LEFT JOIN corrections c ON c.word_id = w.id
         WHERE r.meeting_id = ?
         ORDER BY r.seq, s.seq, w.seq`
      )
      .all(meetingId) as TranscriptRow[]

    const drafts = new Map<string, Map<string, SegmentDraft>>() // Recording → segment (ekleme sırası korunur)
    for (const row of rows) {
      const segments = drafts.get(row.recording_id) ?? new Map<string, SegmentDraft>()
      drafts.set(row.recording_id, segments)
      const segment = segments.get(row.segment_id) ?? {
        id: row.segment_id,
        channel: row.channel,
        startMs: row.segment_start_ms,
        words: []
      }
      segments.set(row.segment_id, segment)
      segment.words.push({
        id: row.word_id,
        text: row.text,
        isSuspect: row.is_suspect === 1,
        corrected: row.corrected,
        startMs: row.word_start_ms
      })
    }

    const recordings: TranscriptRecording[] = [...drafts].map(([id, segments]) => ({
      id,
      segments: mergeChannels([...segments.values()])
    }))
    return { meetingId, recordings }
  }

  // İki kanalın segmentlerini başlangıç zamanına göre tek akışa birleştirir; yankı sayılan `mic` kelimeleri
  // (ADR-0007) Transcript'e girmez, tüm kelimeleri atılan segment görünmez.
  function mergeChannels(segments: SegmentDraft[]): TranscriptSegment[] {
    const wordsOf = (channel: AudioChannel): { id: string; text: string; startMs: number }[] =>
      segments.filter((segment) => segment.channel === channel).flatMap((segment) => segment.words)
    const micSegments = segments
      .filter((segment) => segment.channel === 'mic')
      .map((segment) => ({ wordIds: segment.words.map((word) => word.id) }))
    const echoes = expandEchoesBySegment(
      micSegments,
      dropIsolatedEchoes(
        micSegments,
        findEchoWordIds(wordsOf('mic'), wordsOf('system'), ECHO_WINDOW_MS),
        ECHO_MIN_RUN
      ),
      { minEchoes: ECHO_SEGMENT_MIN_ECHOES, minRatio: ECHO_SEGMENT_MIN_RATIO }
    )

    return segments
      .map((segment) => ({
        ...segment,
        words: segment.words.filter((word) => !echoes.has(word.id))
      }))
      .filter((segment) => segment.words.length > 0)
      .sort(
        (a, b) =>
          a.startMs - b.startMs || (a.channel === b.channel ? 0 : a.channel === 'mic' ? -1 : 1)
      )
      .map((segment) => ({
        id: segment.id,
        side: SIDE[segment.channel],
        words: segment.words.map(({ id, text, isSuspect, corrected }) => ({
          id,
          text,
          isSuspect,
          corrected
        }))
      }))
  }

  // Correction yalnızca Transcribed Meeting'in Suspect Word'üne yazılabilir (UI'a güvenilmez).
  function writableWord(wordId: unknown): WordContext {
    if (typeof wordId !== 'string') throw new TranscriptError('invalid-input', 'Geçersiz kelime.')
    const word = db
      .prepare(
        `SELECT w.text, w.is_suspect, m.state, m.language
         FROM words w
         JOIN segments s ON s.id = w.segment_id
         JOIN recordings r ON r.id = s.recording_id
         JOIN meetings m ON m.id = r.meeting_id
         WHERE w.id = ?`
      )
      .get(wordId) as WordContext | undefined
    if (!word) throw new TranscriptError('word-not-found', 'Kelime bulunamadı.')
    if (word.state !== 'transcribed') {
      throw new TranscriptError('not-correctable', 'Bu Meeting’de artık düzeltme yapılamaz.')
    }
    return word
  }

  function correct(wordId: string, corrected: string): string {
    if (typeof corrected !== 'string') {
      throw new TranscriptError('invalid-input', 'Düzeltme metin olmalı.')
    }
    const word = writableWord(wordId)
    if (word.is_suspect !== 1) {
      throw new TranscriptError('not-suspect', 'Yalnızca şüpheli kelimeler düzeltilebilir.')
    }
    const stored = corrected.trim()
    db.prepare(
      `INSERT INTO corrections (word_id, original, corrected, language, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (word_id) DO UPDATE SET corrected = excluded.corrected`
    ).run(wordId, word.text, stored, word.language, now())
    return stored
  }

  function revert(wordId: string): void {
    writableWord(wordId)
    db.prepare('DELETE FROM corrections WHERE word_id = ?').run(wordId)
  }

  return { get, correct, revert }
}
