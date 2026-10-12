import { closeSync, fstatSync, openSync, readSync } from 'node:fs'
import { AUDIO_FORMAT, BLOCK_ALIGN, BYTES_PER_SECOND } from '../../shared/audio'
import type { WordAudio } from '../../shared/transcript'
import type { Db } from '../db/database'
import { resolveRecordingFile } from '../recordings/recording-paths'
import { WAV_HEADER_BYTES } from '../recordings/wav'
import { TranscriptError } from './transcript-service'

export interface PlaybackWindow {
  startMs: number
  endMs: number
}

// Kelimenin her iki yanına `paddingMs` ekler ve Recording sınırlarına (0 … süre) kırpar.
// Sıfır uzunluklu kelimeler de (start == end) pencerenin ortasında kalır.
export function playbackWindow(
  wordStartMs: number,
  wordEndMs: number,
  durationMs: number,
  paddingMs: number
): PlaybackWindow {
  const startMs = Math.min(Math.max(0, wordStartMs - paddingMs), durationMs)
  const endMs = Math.min(Math.max(startMs, wordEndMs + paddingMs), durationMs)
  return { startMs, endMs }
}

interface WordAudioRow {
  start_ms: number
  end_ms: number
  file_path: string | null
}

export type WordAudioReader = (wordId: string) => WordAudio

// Bir Suspect Word çevresindeki sesi `mic.wav`'dan keser. Dosya yolu yalnızca DB'deki kelimeden türetilir ve
// `resolveRecordingFile` ile doğrulanır; renderer ham yol göndermez ve almaz.
export function createWordAudioReader({
  db,
  recordingsDir,
  paddingMs
}: {
  db: Db
  recordingsDir: string
  paddingMs: number
}): WordAudioReader {
  const missing = (): TranscriptError =>
    new TranscriptError('audio-missing', 'Bu kelimenin ses dosyası bulunamadı.')

  return (wordId) => {
    if (typeof wordId !== 'string') throw new TranscriptError('invalid-input', 'Geçersiz kelime.')
    const row = db
      .prepare(
        `SELECT w.start_ms, w.end_ms, c.file_path
         FROM words w
         JOIN segments s ON s.id = w.segment_id
         JOIN recordings r ON r.id = s.recording_id
         LEFT JOIN recording_channels c ON c.recording_id = r.id AND c.kind = 'mic'
         WHERE w.id = ?`
      )
      .get(wordId) as WordAudioRow | undefined
    if (!row) throw new TranscriptError('word-not-found', 'Kelime bulunamadı.')
    if (!row.file_path) throw missing()

    let path: string
    try {
      path = resolveRecordingFile(recordingsDir, row.file_path)
    } catch {
      throw missing() // beklenmeyen ya da kayıt klasörü dışına çıkan yol
    }

    let fd: number
    try {
      fd = openSync(path, 'r')
    } catch {
      throw missing()
    }
    try {
      const dataBytes = Math.max(0, fstatSync(fd).size - WAV_HEADER_BYTES)
      const durationMs = (dataBytes / BYTES_PER_SECOND) * 1000
      const { startMs, endMs } = playbackWindow(row.start_ms, row.end_ms, durationMs, paddingMs)
      // Örnek çerçevesine hizalı bayt aralığı
      const startByte =
        Math.floor(((startMs / 1000) * BYTES_PER_SECOND) / BLOCK_ALIGN) * BLOCK_ALIGN
      const endByte = Math.min(
        dataBytes,
        Math.floor(((endMs / 1000) * BYTES_PER_SECOND) / BLOCK_ALIGN) * BLOCK_ALIGN
      )
      const pcm = Buffer.alloc(Math.max(0, endByte - startByte))
      let offset = 0
      while (offset < pcm.length) {
        const read = readSync(
          fd,
          pcm,
          offset,
          pcm.length - offset,
          WAV_HEADER_BYTES + startByte + offset
        )
        if (read === 0) break
        offset += read
      }
      return {
        pcm: new Uint8Array(pcm.buffer, pcm.byteOffset, offset),
        sampleRate: AUDIO_FORMAT.sampleRate
      }
    } finally {
      closeSync(fd)
    }
  }
}
