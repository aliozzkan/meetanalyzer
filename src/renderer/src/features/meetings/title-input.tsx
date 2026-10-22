import { useRef, useState } from 'react'
import { TITLE_MAX_LENGTH, normalizeTitle, type MeetingSummary } from '@shared/meeting'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

interface Props {
  meeting: Pick<MeetingSummary, 'id' | 'title'>
  placeholder: string
  /** Başarılıysa true; hata gösterimi çağıranın işidir. */
  onRename: (id: string, title: string) => Promise<boolean>
  /** Düzenleme bitti (kaydedildi ya da vazgeçildi); çağıran input'u kaldırır. */
  onDone: () => void
  className?: string
}

// Title'ın inline düzenlenmesi (GLOSSARY → Title): Enter ya da odaktan çıkmak kaydeder, Esc vazgeçer.
// Detay başlığı ve sidebar satırı aynı kuralı kullanır. Kırpma ve uzunluk kuralı main'dedir.
export function TitleInput({
  meeting,
  placeholder,
  onRename,
  onDone,
  className
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState(meeting.title ?? '')
  // Enter/Esc sonrası input kaldırılırken gelen blur ikinci bir kaydetme başlatmasın.
  const settled = useRef(false)

  async function save(): Promise<void> {
    if (settled.current) return
    settled.current = true
    // Değişmeyen ad için IPC'ye gidilmez.
    if (normalizeTitle(draft) === meeting.title || (await onRename(meeting.id, draft))) {
      onDone()
    } else {
      settled.current = false
    }
  }

  return (
    <Input
      autoFocus
      aria-label="Meeting adı"
      className={cn('font-heading', className)}
      value={draft}
      maxLength={TITLE_MAX_LENGTH}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={() => void save()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void save()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          settled.current = true
          onDone()
        }
      }}
    />
  )
}
