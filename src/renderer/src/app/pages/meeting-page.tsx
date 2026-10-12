import { Navigate, useNavigate, useParams } from 'react-router'
import { MeetingDetail } from '../../features/meetings/meeting-detail'
import { useAppContext } from '../app-context'
import { paths } from '../paths'

export function MeetingPage(): React.JSX.Element {
  const { meetingId = '' } = useParams()
  const { meetings, transcription, recorder, removeMeeting } = useAppContext()
  const navigate = useNavigate()

  // Silinmiş ya da hiç olmamış bir Meeting'in adresi (ör. eski yer imi) Home'a döner.
  if (meetings.loaded && !meetings.meetings.some((meeting) => meeting.id === meetingId)) {
    return <Navigate to={paths.home} replace />
  }

  return (
    <MeetingDetail
      api={meetings}
      transcription={transcription}
      recorder={recorder}
      meetingId={meetingId}
      onRemove={async (id) => {
        if (await removeMeeting(id)) void navigate(paths.home, { replace: true })
      }}
    />
  )
}
