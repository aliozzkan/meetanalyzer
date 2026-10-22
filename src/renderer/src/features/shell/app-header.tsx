import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NavLink } from 'react-router'
import { Button } from '@renderer/components/ui/button'
import { RainbowButton } from '@renderer/components/ui/rainbow-button'
import { SidebarTrigger } from '@renderer/components/ui/sidebar'
import { IS_MAC } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { paths } from '../../app/paths'
import type { HistoryNavigation } from './use-history-navigation'

interface Props {
  history: HistoryNavigation
  /** Tam ekranda trafik ışıkları kaybolur; soldaki boşluk da kalkar. */
  fullScreen: boolean
  /** Orta: açık Meeting durumu (`OpenMeetingPill`). */
  center: React.ReactNode
  /** Sağ: model göstergesi (`HeaderModelIndicator`); model hazırken yer kaplamaz. */
  modelIndicator: React.ReactNode
  onViewPlans: () => void
}

// Tam genişlikte, her ekranda görünen header (spec: "Header"). macOS'ta trafik ışıkları soldaki boşluğa oturur
// ve boş alan pencere sürükleme alanıdır; içindeki her kontrol `app-no-drag`. Windows/Linux'ta native başlık
// çubuğu korunur, header boşluksuz ve sürüklemesizdir.
export function AppHeader({
  history,
  fullScreen,
  center,
  modelIndicator,
  onViewPlans
}: Props): React.JSX.Element {
  return (
    <header
      className={cn(
        'flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background px-3',
        IS_MAC && 'app-drag',
        IS_MAC && !fullScreen && 'pl-20'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <NavLink
          to={paths.home}
          className="app-no-drag mr-1 truncate px-1 font-heading font-semibold"
        >
          Meetanalyzing
        </NavLink>
        <SidebarTrigger className="app-no-drag" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Geri"
          title="Geri (⌘[)"
          disabled={!history.canGoBack}
          onClick={history.back}
          className="app-no-drag"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="İleri"
          title="İleri (⌘])"
          disabled={!history.canGoForward}
          onClick={history.forward}
          className="app-no-drag"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="flex shrink-0 items-center justify-center">{center}</div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {modelIndicator}
        <RainbowButton size="sm" variant="outline" onClick={onViewPlans} className="app-no-drag">
          Planları Görüntüle
        </RainbowButton>
      </div>
    </header>
  )
}
