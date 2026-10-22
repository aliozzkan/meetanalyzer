import { useMatch } from 'react-router'
import type { MeetingSummary } from '@shared/meeting'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu
} from '@renderer/components/ui/sidebar'
import { paths } from '../../app/paths'
import type { TranscriptionStatus } from '@shared/transcription'
import { groupMeetingsByDate } from './group-meetings'
import { MeetingRow, type MeetingRowCommands } from './meeting-row'
import { useNow } from './use-now'

interface Props {
  meetings: MeetingSummary[]
  loaded: boolean
  transcription: TranscriptionStatus
  commands: MeetingRowCommands
}

// Meeting'ler tarih gruplarıyla listelenir; satır adı Title, yoksa Meeting'in saatidir.
export function MeetingNav({
  meetings,
  loaded,
  transcription,
  commands
}: Props): React.JSX.Element {
  const now = useNow()
  const match = useMatch(paths.meetingPattern)
  const activeId = match?.params.meetingId

  if (loaded && meetings.length === 0) {
    return (
      <p className="px-4 py-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
        Henüz Meeting yok
      </p>
    )
  }

  return (
    <>
      {groupMeetingsByDate(meetings, now).map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.meetings.map((meeting) => (
                <MeetingRow
                  key={meeting.id}
                  meeting={meeting}
                  active={meeting.id === activeId}
                  transcription={transcription}
                  commands={commands}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
