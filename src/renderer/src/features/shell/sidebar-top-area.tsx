import { ChevronDown, CornerUpLeft, Plus, Square } from 'lucide-react'
import { LANGUAGES, type Language } from '@shared/meeting'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@renderer/components/ui/sidebar'
import { LANGUAGE_LABELS } from '../meetings/labels'
import { formatElapsed } from '../recording/format-elapsed'
import type { SidebarTopState } from './sidebar-top'

interface Props {
  state: SidebarTopState
  onStart: (language: Language) => void
  onOpen: (meetingId: string) => void
  onStop: () => void
  defaultLanguage: Language
}

// Sidebar'ın üst alanı: Yeni Meeting split button'u, "Açık Meeting'e dön" ya da kayıt pill'i.
// İkon modunda sağdaki eylem (▾ / durdur) gizlenir, ana buton ikon ve tooltip'e iner.
export function SidebarTopArea({
  state,
  onStart,
  onOpen,
  onStop,
  defaultLanguage
}: Props): React.JSX.Element {
  return (
    <SidebarGroup className="py-0">
      <SidebarMenu>
        <SidebarMenuItem>
          {state.kind === 'new-meeting' && (
            <>
              <SidebarMenuButton
                tooltip="Yeni Meeting"
                onClick={() => onStart(defaultLanguage)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              >
                <Plus />
                <span>Yeni Meeting</span>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<SidebarMenuAction aria-label="Dil seçerek Yeni Meeting başlat" />}
                >
                  <ChevronDown />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Dil seçerek başlat</DropdownMenuLabel>
                    {LANGUAGES.map((language) => (
                      <DropdownMenuItem key={language} onClick={() => onStart(language)}>
                        {LANGUAGE_LABELS[language]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {state.kind === 'open-meeting' && (
            <SidebarMenuButton
              tooltip="Açık Meeting'e dön"
              onClick={() => onOpen(state.meetingId)}
              className="border border-sidebar-border"
            >
              <CornerUpLeft />
              <span>Açık Meeting&apos;e dön</span>
            </SidebarMenuButton>
          )}

          {state.kind === 'recording' && (
            <>
              <SidebarMenuButton
                tooltip={`Kayıt sürüyor · ${formatElapsed(state.elapsedMs)}`}
                onClick={() => onOpen(state.meetingId)}
                className="bg-destructive text-white hover:bg-destructive hover:text-white"
              >
                <span className="grid size-4 shrink-0 place-items-center" aria-hidden>
                  <span className="size-2.5 animate-pulse rounded-full bg-white" />
                </span>
                <span className="tabular-nums">
                  Kayıt sürüyor · {formatElapsed(state.elapsedMs)}
                </span>
              </SidebarMenuButton>
              <SidebarMenuAction
                aria-label="Kaydı durdur"
                onClick={onStop}
                disabled={!state.canStop}
                className="text-white [&_svg]:text-white disabled:opacity-50"
              >
                <Square className="fill-current" />
              </SidebarMenuAction>
            </>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
