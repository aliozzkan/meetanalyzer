import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import type { Language } from '@shared/meeting'
import { paths } from '../../app/paths'
import type { DefaultLanguageApi } from '../settings/use-default-language'
import { newMeetingShortcutAction } from './new-meeting'
import type { MeetingsApi } from './use-meetings'

export interface NewMeetingApi {
  /** Meeting'i başlatır ve açar (Home, sidebar split button'u). */
  start: (language: Language) => Promise<void>
  /** ⌘N: Default Language ile başlatır; açık Meeting varsa ona gider. */
  startFromShortcut: () => void
}

export function useNewMeeting(
  meetings: MeetingsApi,
  defaultLanguage: DefaultLanguageApi
): NewMeetingApi {
  const navigate = useNavigate()
  const ready = meetings.loaded && defaultLanguage.loaded
  // Kısayol, uygulama açılırken (pencere kapalıyken seçilen menü komutu) liste ve ayar okunmadan gelebilir;
  // o zaman açık Meeting görülemez ya da yanlış dil önerilir, bu yüzden ikisi yüklenene kadar bekletilir.
  const shortcutPending = useRef(false)
  // Başlatma sürerken gelen ikinci istek (çift tıklama, art arda ⌘N) yok sayılır; ilki liste yenilenince
  // açık Meeting'i görünür kılar.
  const starting = useRef(false)

  const { start: startMeeting } = meetings
  const start = useCallback(
    async (language: Language): Promise<void> => {
      if (starting.current) return
      starting.current = true
      try {
        const meeting = await startMeeting(language)
        if (meeting) void navigate(paths.meeting(meeting.id))
      } finally {
        starting.current = false
      }
    },
    [startMeeting, navigate]
  )

  const runShortcut = useCallback((): void => {
    const action = newMeetingShortcutAction(meetings.meetings, defaultLanguage.language)
    if (action.kind === 'go') void navigate(paths.meeting(action.meetingId))
    else void start(action.language)
  }, [meetings.meetings, defaultLanguage.language, navigate, start])

  useEffect(() => {
    if (!ready || !shortcutPending.current) return
    shortcutPending.current = false
    runShortcut()
  }, [ready, runShortcut])

  return {
    start,
    startFromShortcut: () => {
      if (ready) runShortcut()
      else shortcutPending.current = true
    }
  }
}
