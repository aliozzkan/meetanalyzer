import { TriangleAlertIcon } from 'lucide-react'
import type { MeetingSummary } from '@shared/meeting'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Progress } from '@renderer/components/ui/progress'
import type { TranscriptionApi } from './use-transcription'

interface Props {
  meeting: MeetingSummary
  transcription: TranscriptionApi
  /** Liste satırı için tek satırlık özet; ayrıntı ekranı ilerleme çubuğu ve uyarıları da gösterir. */
  compact?: boolean
}

// Transcribing: "Sırada" ya da işleniyor + yüzde; Closed: son Transcription hatası.
export function MeetingTranscriptionStatus({
  meeting,
  transcription,
  compact = false
}: Props): React.JSX.Element | null {
  const { active, queued } = transcription.status

  if (meeting.state === 'closed' && meeting.lastError) {
    if (compact) return <span className="text-sm text-destructive">{meeting.lastError}</span>
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

  const isActive = active?.meetingId === meeting.id
  const isQueued = queued.includes(meeting.id)
  // Durum olayı henüz gelmediyse (ilk anlar) ne sırada ne işleniyor görünür: sırada say.
  const waiting = !isActive || isQueued
  const percent = isActive ? active.percent : null

  if (compact) {
    if (waiting) return <span className="text-sm">Sırada</span>
    return <span className="text-sm">{percent === null ? 'Hazırlanıyor…' : `%${percent}`}</span>
  }

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
