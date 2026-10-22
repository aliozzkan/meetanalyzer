import { PencilIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { TITLE_MAX_LENGTH, normalizeTitle, type MeetingSummary } from '@shared/meeting'
import { Input } from '@renderer/components/ui/input'
import { formatMeetingDate } from './format-date'

interface Props {
  meeting: MeetingSummary
  /** Başarılıysa true; hata gösterimi çağıranın işidir. */
  onRename: (id: string, title: string) => Promise<boolean>
}

// Detay başlığında inline düzenlenen Title (GLOSSARY → Title). Tıklayınca düzenlenir;
// Enter ya da odaktan çıkmak kaydeder, Esc vazgeçer. Kırpma ve uzunluk kuralı main'dedir.
export function MeetingTitle({ meeting, onRename }: Props): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  // Enter/Esc sonrası input kaldırılırken gelen blur ikinci bir kaydetme başlatmasın.
  const settled = useRef(false)
  const placeholder = formatMeetingDate(meeting.createdAt)

  function edit(): void {
    settled.current = false
    setDraft(meeting.title ?? '')
  }

  async function save(value: string): Promise<void> {
    if (settled.current) return
    settled.current = true
    // Değişmeyen ad için IPC'ye gidilmez.
    if (normalizeTitle(value) === meeting.title || (await onRename(meeting.id, value))) {
      setDraft(null)
    } else {
      settled.current = false
    }
  }

  function cancel(): void {
    settled.current = true
    setDraft(null)
  }

  if (draft !== null) {
    return (
      <Input
        autoFocus
        aria-label="Meeting adı"
        className="h-9 text-xl font-heading"
        value={draft}
        maxLength={TITLE_MAX_LENGTH}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.target.select()}
        onBlur={() => void save(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void save(draft)
          } else if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          }
        }}
      />
    )
  }

  return (
    <h2 className="text-xl font-heading">
      <button
        type="button"
        title="Yeniden adlandır"
        className="group flex max-w-full items-center gap-2 rounded-base text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        onClick={edit}
      >
        <span className={meeting.title ? 'truncate' : 'truncate text-foreground/50'}>
          {meeting.title ?? placeholder}
        </span>
        <PencilIcon className="size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60" />
      </button>
    </h2>
  )
}
