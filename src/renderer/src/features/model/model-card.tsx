import { DownloadIcon, TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { TRANSCRIPTION_MODEL_INFO } from '@shared/model-info'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Progress } from '@renderer/components/ui/progress'
import { downloadPercent, megabytes } from './model-status'
import type { ModelApi } from './use-model'

const DISMISSED_KEY = 'model-onboarding-dismissed'

// "Gösterildi" bilgisi yalnızca arayüz tercihidir; silinirse soru yeniden çıkar, zararı yok.
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

// Transcription modelinin durumu: ilk açılışta indirme sorusu, indirme sürerken ilerleme, hatada yeniden deneme.
// Hazırsa (ya da soru atlanmışsa) hiçbir şey göstermez.
interface Props {
  model: ModelApi
  /** Transcribe model yokken basıldı: "Şimdilik atla" bayrağı yok sayılır ve soru yeniden gösterilir. */
  forceAsk?: boolean
  /** Soru bu sefer de atlandı. */
  onSkip?: () => void
}

export function ModelCard({ model, forceAsk = false, onSkip }: Props): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(readDismissed)
  const { state } = model

  if (!state || state.status === 'ready') return null

  if (state.status === 'downloading') {
    const percent = downloadPercent(state.receivedBytes, state.totalBytes)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transcription modeli indiriliyor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress aria-label="Model indirme ilerlemesi" value={percent} />
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              {state.receivedBytes >= state.totalBytes
                ? 'Doğrulanıyor…'
                : `%${percent} · ${megabytes(state.receivedBytes)} / ${megabytes(state.totalBytes)}`}
            </span>
            <Button size="sm" variant="outline" onClick={model.cancel}>
              İptal
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (state.status === 'error') {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Model indirilemedi</AlertTitle>
        <AlertDescription>
          <p>{state.message}</p>
          {state.partialBytes > 0 && (
            <p className="mt-1">
              İndirilen {megabytes(state.partialBytes)} saklandı; yeniden deneyince kaldığı yerden
              devam eder.
            </p>
          )}
          <Button size="sm" className="mt-3" onClick={model.start}>
            Yeniden dene
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // missing
  if (dismissed && !forceAsk) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Transcription modeli (~{megabytes(TRANSCRIPTION_MODEL_INFO.sizeBytes)}) indirilsin mi?
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p>
          Toplantı seslerini metne dökmek için bir model gerekir. Model cihazında çalışır; ses
          kayıtların cihazından çıkmaz. Kayıt almak için modele ihtiyacın yok, istersen sonra da
          indirebilirsin.
        </p>
        {state.partialBytes > 0 && (
          <p className="text-sm">
            Yarım kalmış bir indirme var ({megabytes(state.partialBytes)}); kaldığı yerden devam
            eder.
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={model.start}>
            <DownloadIcon /> İndir
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                localStorage.setItem(DISMISSED_KEY, '1')
              } catch {
                // kalıcı saklanamazsa yalnızca bu oturum için atlanır
              }
              setDismissed(true)
              onSkip?.()
            }}
          >
            Şimdilik atla
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
