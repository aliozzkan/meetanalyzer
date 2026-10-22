import { Badge } from '@renderer/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { ApprovedTranscript } from '../correction/approved-transcript'
import { ApproveSection } from '../correction/approve-section'
import { TranscriptView } from '../correction/transcript-view'
import { useTranscript } from '../correction/use-transcript'
import { RecordingControls } from '../recording/recording-controls'
import { isBusyWith } from '../recording/recorder-controller'
import type { Recorder } from '../recording/use-recorder'
import { formatMeetingDate } from './format-date'
import { LANGUAGE_LABELS, STATE_LABELS } from './labels'
import { MeetingActions } from './meeting-actions'
import { MeetingTitle } from './meeting-title'
import { MeetingTranscriptionStatus } from '../transcription/transcription-status'
import type { TranscriptionApi } from '../transcription/use-transcription'
import type { MeetingsApi } from './use-meetings'

interface Props {
  api: MeetingsApi
  transcription: TranscriptionApi
  recorder: Recorder
  meetingId: string
  /** Silme onaylandı; çağıran önce Recording'i bitirir, sonra siler ve ekrandan çıkar. */
  onRemove: (id: string) => Promise<void>
}

export function MeetingDetail({
  api,
  transcription,
  recorder,
  meetingId,
  onRemove
}: Props): React.JSX.Element {
  const meeting = api.meetings.find((candidate) => candidate.id === meetingId)

  return (
    <div className="flex flex-col gap-6">
      {!meeting ? (
        // Meeting yoksa (silinmiş/hiç olmamış) sayfa Home'a yönlendirir; burada yalnızca ilk yükleme beklenir.
        <p>Yükleniyor…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <MeetingTitle meeting={meeting} onRename={api.rename} />
              <span className="text-sm">
                {/* Title varken tarih başlıktan düştüğü için burada gösterilir. */}
                {meeting.title && `${formatMeetingDate(meeting.createdAt)} · `}
                {LANGUAGE_LABELS[meeting.language]} · {meeting.recordingCount} kayıt
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{STATE_LABELS[meeting.state]}</Badge>
              <MeetingActions
                meeting={meeting}
                onClose={api.close}
                onTranscribe={transcription.transcribe}
                closeDisabled={isBusyWith(recorder, meetingId)}
                onRemove={(id) => void onRemove(id)}
              />
            </div>
          </div>

          <MeetingTranscriptionStatus meeting={meeting} transcription={transcription} />

          {meeting.state === 'transcribed' && (
            <CorrectionSection key={meeting.id} meetingId={meeting.id} onApproved={api.refresh} />
          )}
          {meeting.state === 'approved' && (
            <ApprovedTranscript key={meeting.id} meetingId={meeting.id} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Kayıtlar</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {meeting.recordingCount === 0 && <p>Bu Meeting’de henüz kayıt yok.</p>}
              {meeting.state === 'recording' && (
                <RecordingControls recorder={recorder} meetingId={meeting.id} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// Transcript yalnızca Transcribed Meeting'de yüklenir; bu yüzden ayrı bir bileşendir.
function CorrectionSection({
  meetingId,
  onApproved
}: {
  meetingId: string
  onApproved: () => Promise<void>
}): React.JSX.Element {
  const api = useTranscript(meetingId)
  return (
    <>
      <TranscriptView api={api} />
      <ApproveSection meetingId={meetingId} api={api} onApproved={onApproved} />
    </>
  )
}
