import { ArrowLeftIcon } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { RecordingControls } from '../recording/recording-controls'
import { useRecorder } from '../recording/use-recorder'
import { formatMeetingDate } from './format-date'
import { LANGUAGE_LABELS, STATE_LABELS } from './labels'
import { MeetingActions } from './meeting-actions'
import type { MeetingsApi } from './use-meetings'

interface Props {
  api: MeetingsApi
  meetingId: string
  onBack: () => void
}

// Transcription (issue 09) ve Correction (10) alanları sonraki issue'larda bu ekrana eklenir.
export function MeetingDetail({ api, meetingId, onBack }: Props): React.JSX.Element {
  const meeting = api.meetings.find((candidate) => candidate.id === meetingId)
  const recorder = useRecorder(meetingId, api.refresh)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="neutral" size="sm" onClick={onBack}>
          <ArrowLeftIcon /> Meeting&apos;ler
        </Button>
      </div>

      {!meeting ? (
        <p>{api.loaded ? 'Bu Meeting artık yok.' : 'Yükleniyor…'}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-heading">{formatMeetingDate(meeting.createdAt)}</h2>
              <span className="text-sm">{LANGUAGE_LABELS[meeting.language]}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{STATE_LABELS[meeting.state]}</Badge>
              <MeetingActions
                meeting={meeting}
                onClose={api.close}
                closeDisabled={recorder.state !== 'idle'}
                onRemove={async (id) => {
                  if (await api.remove(id)) onBack()
                }}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kayıtlar</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p>
                {meeting.recordingCount === 0
                  ? 'Bu Meeting’de henüz kayıt yok.'
                  : `${meeting.recordingCount} kayıt`}
              </p>
              {meeting.state === 'recording' && <RecordingControls recorder={recorder} />}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
