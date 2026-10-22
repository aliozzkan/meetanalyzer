import { DownloadIcon, TriangleAlertIcon } from 'lucide-react'
import type { ModelState } from '@shared/model'
import { Button } from '@renderer/components/ui/button'
import { Progress } from '@renderer/components/ui/progress'
import { cn } from '@renderer/lib/utils'
import { modelIndicator } from './model-status'

interface Props {
  state: ModelState | null
  /** Ayarlar > Transcription Modeli'ni açar. */
  onOpen: () => void
}

// Header'ın sağındaki model göstergesi: sidebar daralsa da görünür; model hazırken hiç render edilmez.
export function HeaderModelIndicator({ state, onOpen }: Props): React.JSX.Element | null {
  const indicator = modelIndicator(state)
  if (!indicator) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onOpen}
      title="Ayarlar > Transcription Modeli"
      className={cn('app-no-drag', indicator.kind === 'error' && 'text-destructive')}
    >
      {indicator.kind === 'missing' && (
        <>
          <DownloadIcon /> Model indirilmedi
        </>
      )}
      {indicator.kind === 'downloading' && (
        <>
          <Progress aria-label="Model indiriliyor" value={indicator.percent} className="w-16" />
          <span className="tabular-nums">%{indicator.percent}</span>
        </>
      )}
      {indicator.kind === 'error' && (
        <>
          <TriangleAlertIcon /> İndirme başarısız
        </>
      )}
    </Button>
  )
}
