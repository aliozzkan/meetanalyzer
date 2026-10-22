import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { NavLink, useMatch } from 'react-router'
import type { MeetingSummary } from '@shared/meeting'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@renderer/components/ui/sidebar'
import { paths } from '../../app/paths'
import type { TranscriptionStatus } from '@shared/transcription'
import { groupMeetingsByDate } from './group-meetings'
import { meetingLabel } from './meeting-label'
import { MeetingStatusIcon } from './meeting-status-icon'
import { useNow } from './use-now'

interface Props {
  meetings: MeetingSummary[]
  loaded: boolean
  transcription: TranscriptionStatus
}

// Meeting'ler tarih gruplarıyla listelenir; satır adı Title, yoksa Meeting'in saatidir.
export function MeetingNav({ meetings, loaded, transcription }: Props): React.JSX.Element {
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
              {group.meetings.map((meeting) => {
                const label = meetingLabel(meeting)
                return (
                  <SidebarMenuItem key={meeting.id}>
                    <SidebarMenuButton
                      isActive={meeting.id === activeId}
                      tooltip={label}
                      render={<NavLink to={paths.meeting(meeting.id)} />}
                    >
                      <span className="grid size-4 shrink-0 place-items-center">
                        <MeetingStatusIcon meeting={meeting} transcription={transcription} />
                      </span>
                      <span className="truncate">{label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {format(meeting.createdAt, 'd MMM', { locale: tr })}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
