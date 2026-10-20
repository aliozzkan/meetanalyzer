import { Monitor, Moon, Sun } from 'lucide-react'
import { THEMES, type Theme } from '@shared/settings'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { SidebarMenuButton } from '@renderer/components/ui/sidebar'
import { THEME_LABELS } from './labels'
import { useTheme } from './use-theme'

const THEME_ICONS: Record<Theme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon }

// Sidebar footer'ındaki tema menüsü; Ayarlar > Genel'deki Tema ile aynı değeri paylaşır.
export function ThemeMenu(): React.JSX.Element {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICONS[theme]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton tooltip={`Tema: ${THEME_LABELS[theme]}`} />}>
        <Icon />
        <span>Tema: {THEME_LABELS[theme]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start">
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
          {THEMES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} closeOnClick>
              {THEME_LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
