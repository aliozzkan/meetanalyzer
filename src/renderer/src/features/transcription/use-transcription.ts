import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { statusShape, type TranscriptionStatus } from '@shared/transcription'
import type { ModelApi } from '../model/use-model'

export interface TranscriptionApi {
  status: TranscriptionStatus
  /** Model hazır değilse model sorusu gösterilir; indirme bitince Transcribe kendiliğinden sürer. */
  transcribe: (meetingId: string) => void
  /** Transcribe için bekleyen model sorusu var mı (ModelCard soruyu yeniden göstermeli). */
  askingModel: boolean
  /** Model sorusu atlandı: bekleyen Transcribe iptal olur. */
  declineModel: () => void
}

const EMPTY: TranscriptionStatus = { active: null, queued: [] }

// Meeting'in kuyruğa girmesi, sırası ve ilerlemesi main'den gelir. Kuyruğa girme/çıkma Meeting
// durumunu değiştirdiği için bu anlarda `onMeetingsChanged` ile liste yeniden okunur.
export function useTranscription(
  model: ModelApi,
  onMeetingsChanged: () => Promise<void>
): TranscriptionApi {
  const [status, setStatus] = useState<TranscriptionStatus>(EMPTY)
  const [pendingMeetingId, setPendingMeetingId] = useState<string | null>(null)
  const lastShape = useRef('')

  const apply = useCallback(
    (next: TranscriptionStatus) => {
      setStatus(next)
      const shape = statusShape(next)
      if (shape !== lastShape.current) {
        lastShape.current = shape
        void onMeetingsChanged()
      }
    },
    [onMeetingsChanged]
  )

  useEffect(() => {
    let cancelled = false
    void window.api.transcription.getStatus().then((initial) => {
      if (!cancelled) apply(initial)
    })
    const unsubscribe = window.api.transcription.onStatus(apply)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [apply])

  const enqueue = useCallback(
    async (meetingId: string): Promise<void> => {
      const result = await window.api.transcription.enqueue(meetingId)
      if (!result.ok) toast.error(result.message)
      await onMeetingsChanged()
    },
    [onMeetingsChanged]
  )

  const modelReady = model.state?.status === 'ready'

  // Model sorusu yanıtlanıp indirme bitince bekleyen Transcribe sürer.
  useEffect(() => {
    if (!pendingMeetingId || !modelReady) return
    void enqueue(pendingMeetingId).finally(() => setPendingMeetingId(null))
  }, [pendingMeetingId, modelReady, enqueue])

  return {
    status,
    askingModel: pendingMeetingId !== null && !modelReady,
    transcribe: (meetingId) => {
      if (modelReady) void enqueue(meetingId)
      else setPendingMeetingId(meetingId)
    },
    declineModel: () => setPendingMeetingId(null)
  }
}
