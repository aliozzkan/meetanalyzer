import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Transcript, TranscriptResult } from '@shared/transcript'

export interface TranscriptApi {
  /** Yüklenene kadar null. */
  transcript: Transcript | null
  /** Başarısızsa false döner (hata kullanıcıya bildirilir). */
  correct: (wordId: string, corrected: string) => Promise<boolean>
  revert: (wordId: string) => Promise<boolean>
}

// Yalnızca etkilenen segment yeni nesne olur; React.memo'lu diğer segmentler yeniden çizilmez.
function withCorrection(
  transcript: Transcript,
  wordId: string,
  corrected: string | null
): Transcript {
  const changesWord = (words: { id: string }[]): boolean => words.some((word) => word.id === wordId)
  return {
    ...transcript,
    recordings: transcript.recordings.map((recording) =>
      recording.segments.some((segment) => changesWord(segment.words))
        ? {
            ...recording,
            segments: recording.segments.map((segment) =>
              changesWord(segment.words)
                ? {
                    ...segment,
                    words: segment.words.map((word) =>
                      word.id === wordId ? { ...word, corrected } : word
                    )
                  }
                : segment
            )
          }
        : recording
    )
  }
}

export function useTranscript(meetingId: string): TranscriptApi {
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  // Aynı kelimenin kaydet/geri al çağrıları sırayla çalışır; IPC dönüşleri karışıp ekranı
  // veritabanından farklı bırakmasın.
  const inFlight = useRef(new Map<string, Promise<unknown>>())

  useEffect(() => {
    let cancelled = false
    void window.api.transcript.get(meetingId).then((result) => {
      if (cancelled) return
      if (result.ok) setTranscript(result.value)
      else toast.error(result.message)
    })
    return () => {
      cancelled = true
    }
  }, [meetingId])

  // Çağrıyı kelimenin sırasına ekler; başarılıysa ekrandaki Correction'ı `toCorrected` ile günceller.
  const update = useCallback(
    <T>(
      wordId: string,
      call: () => Promise<TranscriptResult<T>>,
      toCorrected: (value: T) => string | null
    ): Promise<boolean> => {
      const run = (inFlight.current.get(wordId) ?? Promise.resolve()).then(async () => {
        const result = await call()
        if (!result.ok) {
          toast.error(result.message)
          return false
        }
        const corrected = toCorrected(result.value)
        setTranscript((current) => current && withCorrection(current, wordId, corrected))
        return true
      })
      inFlight.current.set(wordId, run)
      return run
    },
    []
  )

  const correct = useCallback(
    (wordId: string, corrected: string) =>
      // Main metni kırpıp saklar; ekranda da saklanan değer görünür.
      update(
        wordId,
        () => window.api.transcript.correct(wordId, corrected),
        (stored) => stored
      ),
    [update]
  )
  const revert = useCallback(
    (wordId: string) =>
      update(
        wordId,
        () => window.api.transcript.revert(wordId),
        () => null
      ),
    [update]
  )

  return { transcript, correct, revert }
}
