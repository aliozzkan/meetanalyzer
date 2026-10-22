import { Settings } from 'lucide-react'
import { NavLink } from 'react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger
} from '@renderer/components/ui/sidebar'
import { cn } from '@renderer/lib/utils'
import { IS_MAC } from '@renderer/lib/platform'
import { paths } from '../../app/paths'
import { MeetingNav } from '../meetings/meeting-nav'
import type { MeetingRowCommands } from '../meetings/meeting-row'
import { ThemeMenu } from '../settings/theme-menu'
import type { MeetingsApi } from '../meetings/use-meetings'
import type { TranscriptionApi } from '../transcription/use-transcription'

interface Props {
  meetings: MeetingsApi
  transcription: TranscriptionApi
  /** Satır menüsündeki işlemler (Yeniden adlandır, Kapat, Metne dök, Sil). */
  meetingCommands: MeetingRowCommands
  onOpenSettings: () => void
  /** Üst alan: Yeni Meeting split button'u ya da Recording pill'i. */
  top: React.ReactNode
}

// Footer'daki model göstergesi issue 07'de gelir.
export function AppSidebar({
  meetings,
  transcription,
  meetingCommands,
  onOpenSettings,
  top
}: Props): React.JSX.Element {
  return (
    <Sidebar
      collapsible="icon"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
    >
      {/* macOS'ta trafik ışıkları sidebar'ın üstüne oturur; başlık alanı pencere sürükleme alanıdır. */}
      <SidebarHeader
        className={cn(
          'flex-row items-center justify-between',
          IS_MAC && 'pt-10',
          'group-data-[collapsible=icon]:justify-center'
        )}
      >
        <NavLink
          to={paths.home}
          className="app-no-drag font-heading font-semibold group-data-[collapsible=icon]:hidden"
        >
          Meetanalyzing
        </NavLink>
        <SidebarTrigger className="app-no-drag" />
      </SidebarHeader>
      {top}
      <SidebarContent>
        <MeetingNav
          meetings={meetings.meetings}
          loaded={meetings.loaded}
          transcription={transcription.status}
          commands={meetingCommands}
        />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Ayarlar" onClick={onOpenSettings}>
              <Settings />
              <span>Ayarlar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
