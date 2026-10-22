import { useState } from 'react'
import type { ModelState } from '@shared/model'
import { TRANSCRIPTION_MODEL_INFO } from '@shared/model-info'
import type { TranscriptionStatus } from '@shared/transcription'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import { Progress } from '@renderer/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { IS_MAC } from '@renderer/lib/platform'
import { downloadPercent, megabytes, modelStatusLabel, removeBlockReason } from './model-status'
import type { ModelApi } from './use-model'

interface Props {
  model: ModelApi
  transcription: TranscriptionStatus
}

// Ayarlar > Transcription Modeli. Bugün tek model var; liste biçimi backlog 06'daki model seçimine hazırdır.
export function ModelSection({ model, transcription }: Props): React.JSX.Element {
  const { state } = model
  if (!state) return <p className="text-sm text-muted-foreground">Model durumu okunuyor…</p>

  return (
    <ul aria-label="Transcription modelleri" className="divide-y rounded-lg border">
      <li className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{TRANSCRIPTION_MODEL_INFO.displayName}</p>
            <p className="text-sm text-muted-foreground">
              {megabytes(TRANSCRIPTION_MODEL_INFO.sizeBytes)} · {modelStatusLabel(state)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DownloadAction model={model} state={state} />
            <Button size="sm" variant="outline" onClick={model.showInFolder}>
              {IS_MAC ? "Finder'da göster" : 'Klasörü aç'}
            </Button>
            <RemoveAction model={model} blockReason={removeBlockReason(state, transcription)} />
          </div>
        </div>
        {state.status === 'downloading' && (
          <Progress
            aria-label="Model indirme ilerlemesi"
            value={downloadPercent(state.receivedBytes, state.totalBytes)}
          />
        )}
        {state.status === 'error' && <p className="text-sm text-destructive">{state.message}</p>}
      </li>
    </ul>
  )
}

// Duruma göre indir / sürdür / iptal / yeniden dene; hazır modelde eylem yok.
function DownloadAction({
  model,
  state
}: {
  model: ModelApi
  state: ModelState
}): React.JSX.Element | null {
  switch (state.status) {
    case 'ready':
      return null
    case 'missing':
      return (
        <Button size="sm" onClick={model.start}>
          {state.partialBytes > 0 ? 'Devam et' : 'İndir'}
        </Button>
      )
    case 'downloading':
      return (
        <Button size="sm" variant="outline" onClick={model.cancel}>
          İptal
        </Button>
      )
    case 'error':
      return (
        <Button size="sm" onClick={model.start}>
          Yeniden dene
        </Button>
      )
  }
}

// Sil: devre dışıysa nedeni tooltip'te yazar (buton odaklanabilir kalır ki tooltip açılabilsin); önce onay sorulur.
// "Şimdilik atla" bayrağı sıfırlanmaz: sonraki "Metne dök" soruyu `forceAsk` ile yeniden açar.
function RemoveAction({
  model,
  blockReason
}: {
  model: ModelApi
  blockReason: string | null
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      {blockReason ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="sm"
                variant="destructive"
                disabled
                focusableWhenDisabled
                className="aria-disabled:opacity-50"
              />
            }
          >
            Sil
          </TooltipTrigger>
          <TooltipContent>{blockReason}</TooltipContent>
        </Tooltip>
      ) : (
        <Button size="sm" variant="destructive" onClick={() => setConfirming(true)}>
          Sil
        </Button>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transcription modeli silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Model dosyası (~{megabytes(TRANSCRIPTION_MODEL_INFO.sizeBytes)}) cihazdan silinir.
              Meeting&apos;leri yeniden metne dökmek için modeli tekrar indirmen gerekir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirming(false)
                void model.remove()
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
