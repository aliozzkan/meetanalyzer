import { ChevronRightIcon } from 'lucide-react'
import { Link } from 'react-router'
import type { MeetingState, MeetingSummary } from '@shared/meeting'
import type { TranscriptionStatus } from '@shared/transcription'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from '@renderer/components/ui/item'
import { paths } from '../../app/paths'
import { formatMeetingDate } from './format-date'
import { STATE_LABELS } from './labels'
import { meetingLabel } from './meeting-label'
import { MeetingStatusIcon } from './meeting-status-icon'
import { pendingMeetings } from './pending-meetings'

// Kullanıcıdan beklenen sonraki adım; yalnızca listede görünen durumlar için.
const NEXT_STEP: Partial<Record<MeetingState, string>> = {
  closed: 'metne dökülmeyi bekliyor',
  transcribed: 'düzeltme ve onay bekliyor'
}

interface Props {
  meetings: MeetingSummary[]
  transcription: TranscriptionStatus
}

// Home'daki "Senden işlem bekleyenler" (spec: "Home"): Closed ve Transcribed Meeting'lerin kompakt listesi;
// satır Meeting'i açar. İşlem bekleyen yoksa bölüm hiç gösterilmez.
export function PendingMeetingList({ meetings, transcription }: Props): React.JSX.Element | null {
  const pending = pendingMeetings(meetings)
  if (pending.length === 0) return null

  return (
    <section aria-labelledby="pending-meetings" className="flex flex-col gap-3">
      <h2 id="pending-meetings" className="text-sm font-medium text-muted-foreground">
        Senden işlem bekleyenler
      </h2>
      <ItemGroup className="gap-2">
        {pending.map((meeting) => (
          <Item
            key={meeting.id}
            role="listitem"
            variant="outline"
            size="sm"
            // Nokta deseninin üstünde satırlar okunur kalsın.
            className="bg-background/80 backdrop-blur-sm"
            render={<Link to={paths.meeting(meeting.id)} />}
          >
            <ItemMedia variant="icon" className="size-4">
              <MeetingStatusIcon meeting={meeting} transcription={transcription} />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="block w-full truncate">{meetingLabel(meeting)}</ItemTitle>
              <ItemDescription>
                {STATE_LABELS[meeting.state]} · {NEXT_STEP[meeting.state]}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="text-xs text-muted-foreground">
              {formatMeetingDate(meeting.createdAt)}
              <ChevronRightIcon className="size-4" />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </section>
  )
}
