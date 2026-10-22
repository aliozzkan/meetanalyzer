import { CornerUpLeft, Square } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { formatElapsed } from '../recording/format-elapsed'
import type { OpenMeetingStatus } from './open-meeting-status'

interface Props {
  status: OpenMeetingStatus
  onOpen: (meetingId: string) => void
  onStop: () => void
}

// Header'ın ortası: "Açık Meeting'e dön" ya da kırmızı kayıt pill'i ve durdur. Açık Meeting yokken boş.
// Header her ekranda göründüğü için kayıt başka ekrandayken (sidebar daralmışken de) durdurulabilir.
export function OpenMeetingPill({ status, onOpen, onStop }: Props): React.JSX.Element | null {
  if (status.kind === 'none') return null

  if (status.kind === 'open-meeting') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onOpen(status.meetingId)}
        className="app-no-drag rounded-full"
      >
        <CornerUpLeft />
        Açık Meeting&apos;e dön
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        onClick={() => onOpen(status.meetingId)}
        className="app-no-drag rounded-full bg-destructive text-white hover:bg-destructive/90"
      >
        <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden />
        <span className="tabular-nums">Kayıt sürüyor · {formatElapsed(status.elapsedMs)}</span>
      </Button>
      <Button
        variant="destructive"
        size="icon-sm"
        aria-label="Kaydı durdur"
        title="Kaydı durdur"
        onClick={onStop}
        disabled={!status.canStop}
        className="app-no-drag rounded-full"
      >
        <Square className="fill-current" />
      </Button>
    </div>
  )
}
