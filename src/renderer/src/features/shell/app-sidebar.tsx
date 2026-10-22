import { Settings } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@renderer/components/ui/sidebar'
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
  /** Üst alan: Yeni Meeting split button'u; Recording'de Meeting varken boş. */
  top: React.ReactNode
}

// Uygulama adı, daralt/aç ve trafik ışığı boşluğu header'dadır; sidebar'ın kendi başlık alanı yoktur.
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
