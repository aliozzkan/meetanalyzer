import { useState } from 'react'
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@shared/meeting'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@renderer/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@renderer/components/ui/native-select'
import { formatMeetingDate } from './format-date'
import { LANGUAGE_LABELS, STATE_LABELS } from './labels'
import { MeetingActions } from './meeting-actions'
import { MeetingTranscriptionStatus } from '../transcription/transcription-status'
import type { TranscriptionApi } from '../transcription/use-transcription'
import type { MeetingsApi } from './use-meetings'

interface Props {
  api: MeetingsApi
  transcription: TranscriptionApi
  onOpen: (id: string) => void
}

export function MeetingList({ api, transcription, onOpen }: Props): React.JSX.Element {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE)
  const hasOpenMeeting = api.meetings.some((meeting) => meeting.state === 'recording')

  async function handleStart(): Promise<void> {
    const meeting = await api.start(language)
    if (meeting) onOpen(meeting.id)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect
          aria-label="Meeting dili"
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
        >
          {LANGUAGES.map((code) => (
            <NativeSelectOption key={code} value={code}>
              {LANGUAGE_LABELS[code]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button onClick={handleStart} disabled={hasOpenMeeting}>
          Yeni Meeting
        </Button>
        {hasOpenMeeting && (
          <span className="text-sm">
            Devam eden bir Meeting var; yenisi için onu kapat ya da sil.
          </span>
        )}
      </div>

      {api.loaded && api.meetings.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Henüz Meeting yok</EmptyTitle>
            <EmptyDescription>Dili seçip &quot;Yeni Meeting&quot; ile başla.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <ul className="flex flex-col gap-3">
        {api.meetings.map((meeting) => (
          <li key={meeting.id}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="flex flex-col items-start gap-1 text-left"
                  onClick={() => onOpen(meeting.id)}
                >
                  <span className="font-heading">{formatMeetingDate(meeting.createdAt)}</span>
                  <span className="text-sm">
                    {LANGUAGE_LABELS[meeting.language]} · {meeting.recordingCount} kayıt
                  </span>
                </button>
                <div className="flex items-center gap-3">
                  <MeetingTranscriptionStatus
                    meeting={meeting}
                    transcription={transcription}
                    compact
                  />
                  <Badge>{STATE_LABELS[meeting.state]}</Badge>
                  <MeetingActions
                    meeting={meeting}
                    onClose={api.close}
                    onRemove={api.remove}
                    onTranscribe={transcription.transcribe}
                  />
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
