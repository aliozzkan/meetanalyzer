import { NavLink } from 'react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarTrigger
} from '@renderer/components/ui/sidebar'
import { cn } from '@renderer/lib/utils'
import { IS_MAC } from '@renderer/lib/platform'
import { paths } from '../../app/paths'
import { MeetingNav } from '../meetings/meeting-nav'
import type { MeetingsApi } from '../meetings/use-meetings'
import type { TranscriptionApi } from '../transcription/use-transcription'

interface Props {
  meetings: MeetingsApi
  transcription: TranscriptionApi
}

// Üst alan (Yeni Meeting / kayıt pill'i) issue 03'te, footer (Ayarlar, tema, model) issue 02 ve 07'de gelir.
export function AppSidebar({ meetings, transcription }: Props): React.JSX.Element {
  return (
    <Sidebar collapsible="icon">
      {/* macOS'ta trafik ışıkları sidebar'ın üstüne oturur; başlık alanı pencere sürükleme alanıdır. */}
      <SidebarHeader
        className={cn(
          'app-drag flex-row items-center justify-between',
          IS_MAC && 'pt-10',
          'group-data-[collapsible=icon]:justify-center'
        )}
      >
        <NavLink
          to={paths.home}
          className="app-no-drag font-heading group-data-[collapsible=icon]:hidden"
        >
          Meetanalyzing
        </NavLink>
        <SidebarTrigger className="app-no-drag" />
      </SidebarHeader>
      <SidebarContent>
        <MeetingNav
          meetings={meetings.meetings}
          loaded={meetings.loaded}
          transcription={transcription.status}
        />
      </SidebarContent>
    </Sidebar>
  )
}
