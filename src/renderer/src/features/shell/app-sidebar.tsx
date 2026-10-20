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
import { ThemeMenu } from '../settings/theme-menu'
import type { MeetingsApi } from '../meetings/use-meetings'
import type { TranscriptionApi } from '../transcription/use-transcription'

interface Props {
  meetings: MeetingsApi
  transcription: TranscriptionApi
  onOpenSettings: () => void
  /** Üst alan: Yeni Meeting split button'u ya da Recording pill'i. */
  top: React.ReactNode
}

// Footer'daki model göstergesi issue 07'de gelir.
export function AppSidebar({
  meetings,
  transcription,
  onOpenSettings,
  top
}: Props): React.JSX.Element {
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
      {top}
      <SidebarContent>
        <MeetingNav
          meetings={meetings.meetings}
          loaded={meetings.loaded}
          transcription={transcription.status}
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
