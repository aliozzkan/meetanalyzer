import { TriangleAlertIcon } from 'lucide-react'
import type { MeetingSummary } from '@shared/meeting'
import { isProcessing } from '@shared/transcription'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Progress } from '@renderer/components/ui/progress'
import type { TranscriptionApi } from './use-transcription'

interface Props {
  meeting: MeetingSummary
  transcription: TranscriptionApi
}

// Transcribing: "Sırada" ya da işleniyor + yüzde; Closed: son Transcription hatası.
export function MeetingTranscriptionStatus({
  meeting,
  transcription
}: Props): React.JSX.Element | null {
  const { active } = transcription.status

  if (meeting.state === 'closed' && meeting.lastError) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Transcription tamamlanamadı</AlertTitle>
        <AlertDescription>
          <p>{meeting.lastError}</p>
          <p className="mt-1">
            Yeniden Transcribe edersen yalnızca metne dökülmemiş kayıtlar işlenir.
          </p>
        </AlertDescription>
      </Alert>
    )
  }

  if (meeting.state !== 'transcribing') return null

  const processing = isProcessing(transcription.status, meeting.id)
  const waiting = !processing
  const percent = processing ? (active?.percent ?? null) : null

  return (
    <div className="flex flex-col gap-3">
      {waiting ? (
        <p>Sırada: önceki Meeting bitince başlayacak.</p>
      ) : (
        <>
          <Progress aria-label="Transcription ilerlemesi" value={percent ?? 0} />
          <p className="text-sm">
            {percent === null
              ? 'Hazırlanıyor… İlk kullanımda bu bir dakika kadar sürebilir.'
              : `%${percent} metne döküldü`}
          </p>
        </>
      )}
      <p className="text-sm">Mac&apos;in kapağını kapatırsanız işlem duraklar.</p>
    </div>
  )
}
