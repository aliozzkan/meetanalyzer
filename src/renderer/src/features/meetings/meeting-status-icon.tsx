import { CheckIcon, ClockIcon } from 'lucide-react'
import type { MeetingSummary } from '@shared/meeting'
import { Spinner } from '@renderer/components/ui/spinner'
import { isProcessing, type TranscriptionStatus } from '@shared/transcription'
import { STATE_LABELS } from './labels'

interface Props {
  meeting: MeetingSummary
  transcription: TranscriptionStatus
}

// Sidebar satırındaki durum göstergesi: Recording kırmızı nokta, Closed gri, Transcribing spinner
// (sırada bekliyorsa saat), Transcribed vurgulu nokta (düzeltme bekliyor), Approved tik.
export function MeetingStatusIcon({ meeting, transcription }: Props): React.JSX.Element {
  const label = STATE_LABELS[meeting.state]
  const dot = (className: string): React.JSX.Element => (
    <span role="img" aria-label={label} className={`size-2.5 rounded-full ${className}`} />
  )

  switch (meeting.state) {
    case 'recording':
      return dot('bg-destructive')
    case 'closed':
      return dot('bg-muted-foreground')
    case 'transcribing': {
      return isProcessing(transcription, meeting.id) ? (
        <Spinner aria-label={label} />
      ) : (
        <ClockIcon role="img" aria-label={`${label}: sırada`} />
      )
    }
    case 'transcribed':
      return dot('bg-primary')
    case 'approved':
      return <CheckIcon role="img" aria-label={label} />
  }
}
