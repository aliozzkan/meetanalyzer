import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Language, MeetingResult, MeetingSummary } from '@shared/meeting'

export interface MeetingsApi {
  meetings: MeetingSummary[]
  loaded: boolean
  refresh: () => Promise<void>
  start: (language: Language) => Promise<MeetingSummary | undefined>
  close: (id: string) => Promise<void>
  remove: (id: string) => Promise<boolean>
}

export function useMeetings(): MeetingsApi {
  const [meetings, setMeetings] = useState<MeetingSummary[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    const result = await window.api.meetings.list()
    if (result.ok) setMeetings(result.value)
    setLoaded(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.api.meetings.list().then((result) => {
      if (cancelled) return
      if (result.ok) setMeetings(result.value)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Servis hatası kullanıcıya bildirilir; başarılı ya da değil, liste yeniden okunur.
  const act = useCallback(
    async <T>(call: Promise<MeetingResult<T>>): Promise<MeetingResult<T>> => {
      const result = await call
      if (!result.ok) toast.error(result.message)
      await refresh()
      return result
    },
    [refresh]
  )

  return {
    meetings,
    loaded,
    refresh,
    start: async (language) => {
      const result = await act(window.api.meetings.start(language))
      return result.ok ? result.value : undefined
    },
    close: async (id) => {
      await act(window.api.meetings.close(id))
    },
    remove: async (id) => (await act(window.api.meetings.remove(id))).ok
  }
}
