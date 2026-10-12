import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Transcript } from '@shared/transcript'

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
  return {
    ...transcript,
    recordings: transcript.recordings.map((recording) => {
      if (!recording.segments.some((segment) => segment.words.some((word) => word.id === wordId))) {
        return recording
      }
      return {
        ...recording,
        segments: recording.segments.map((segment) =>
          segment.words.some((word) => word.id === wordId)
            ? {
                ...segment,
                words: segment.words.map((word) =>
                  word.id === wordId ? { ...word, corrected } : word
                )
              }
            : segment
        )
      }
    })
  }
}

export function useTranscript(meetingId: string): TranscriptApi {
  const [transcript, setTranscript] = useState<Transcript | null>(null)

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

  const correct = useCallback(async (wordId: string, corrected: string): Promise<boolean> => {
    const result = await window.api.transcript.correct(wordId, corrected)
    if (!result.ok) {
      toast.error(result.message)
      return false
    }
    // Main metni kırpar; ekranda da aynı değer görünsün.
    setTranscript((current) => current && withCorrection(current, wordId, corrected.trim()))
    return true
  }, [])

  const revert = useCallback(async (wordId: string): Promise<boolean> => {
    const result = await window.api.transcript.revert(wordId)
    if (!result.ok) {
      toast.error(result.message)
      return false
    }
    setTranscript((current) => current && withCorrection(current, wordId, null))
    return true
  }, [])

  return { transcript, correct, revert }
}
