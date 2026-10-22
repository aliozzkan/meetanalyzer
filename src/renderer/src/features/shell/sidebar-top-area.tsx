import { ChevronDown, Plus } from 'lucide-react'
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

interface Props {
  onStart: (language: Language) => void
  defaultLanguage: Language
}

// Sidebar'ın üst alanı: Yeni Meeting split button'u. Recording'de Meeting varken gösterilmez; o Meeting'e
// header'daki pill'den dönülür. İkon modunda ▾ gizlenir, ana buton ikon ve tooltip'e iner.
export function SidebarTopArea({ onStart, defaultLanguage }: Props): React.JSX.Element {
  return (
    <SidebarGroup className="pb-0">
      <SidebarMenu>
        <SidebarMenuItem>
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
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
