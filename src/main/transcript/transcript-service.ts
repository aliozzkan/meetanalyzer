import type { Language, MeetingState } from '../../shared/meeting'
import type {
  Transcript,
  TranscriptErrorCode,
  TranscriptRecording,
  TranscriptSegment
} from '../../shared/transcript'
import type { Db } from '../db/database'

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
  word_id: string
  text: string
  is_suspect: number
  corrected: string | null
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
        `SELECT r.id AS recording_id, s.id AS segment_id, w.id AS word_id, w.text, w.is_suspect,
                c.corrected
         FROM recordings r
         JOIN segments s ON s.recording_id = r.id
         JOIN words w ON w.segment_id = s.id
         LEFT JOIN corrections c ON c.word_id = w.id
         WHERE r.meeting_id = ?
         ORDER BY r.seq, s.seq, w.seq`
      )
      .all(meetingId) as TranscriptRow[]

    const recordings: TranscriptRecording[] = []
    let recording: TranscriptRecording | undefined
    let segment: TranscriptSegment | undefined
    for (const row of rows) {
      if (recording?.id !== row.recording_id) {
        recording = { id: row.recording_id, segments: [] }
        recordings.push(recording)
        segment = undefined
      }
      if (segment?.id !== row.segment_id) {
        segment = { id: row.segment_id, words: [] }
        recording!.segments.push(segment)
      }
      segment.words.push({
        id: row.word_id,
        text: row.text,
        isSuspect: row.is_suspect === 1,
        corrected: row.corrected
      })
    }
    return { meetingId, recordings }
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
