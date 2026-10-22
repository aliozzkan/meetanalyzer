import { PencilIcon } from 'lucide-react'
import { useState } from 'react'
import type { MeetingSummary } from '@shared/meeting'
import { formatMeetingDate } from './format-date'
import { TitleInput } from './title-input'

interface Props {
  meeting: MeetingSummary
  /** Başarılıysa true; hata gösterimi çağıranın işidir. */
  onRename: (id: string, title: string) => Promise<boolean>
}

// Detay başlığındaki Title; tıklayınca inline düzenlenir. Boşken yer tutucu olarak tarih görünür.
export function MeetingTitle({ meeting, onRename }: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const placeholder = formatMeetingDate(meeting.createdAt)

  if (editing) {
    return (
      <TitleInput
        meeting={meeting}
        placeholder={placeholder}
        onRename={onRename}
        onDone={() => setEditing(false)}
        className="h-9 text-xl"
      />
    )
  }

  return (
    <h2 className="text-xl font-heading">
      <button
        type="button"
        title="Yeniden adlandır"
        className="group flex max-w-full items-center gap-2 rounded-base text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        onClick={() => setEditing(true)}
      >
        <span className={meeting.title ? 'truncate' : 'truncate text-foreground/50'}>
          {meeting.title ?? placeholder}
        </span>
        <PencilIcon className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
      </button>
    </h2>
  )
}
