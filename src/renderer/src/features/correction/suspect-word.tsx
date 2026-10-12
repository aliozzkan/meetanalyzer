import { useRef, useState } from 'react'
import { wordDisplay, type TranscriptWord } from '@shared/transcript'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { cn } from '@renderer/lib/utils'

interface Props {
  word: TranscriptWord
  onCorrect: (wordId: string, corrected: string) => Promise<boolean>
  onRevert: (wordId: string) => Promise<boolean>
}

// Tıklanabilir Suspect Word: popover'daki input Correction'ı (serbest metin, boş olabilir) kaydeder.
// Correction yalnızca bu kelimenin yerine geçer; orijinal metin title'da kalır.
export function SuspectWord({ word, onCorrect, onRevert }: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isCorrected = word.corrected !== null
  const display = wordDisplay(word)

  async function save(): Promise<void> {
    if (await onCorrect(word.id, draft)) setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(word.corrected ?? word.text)
        setOpen(next)
      }}
    >
      <PopoverTrigger
        title={isCorrected ? `Orijinal: ${word.text}` : 'Şüpheli kelime: düzeltmek için tıkla'}
        className={cn(
          'cursor-pointer rounded-base px-0.5 underline decoration-dotted underline-offset-4',
          isCorrected ? 'bg-main/20' : 'bg-yellow-200 text-black'
        )}
      >
        {display.kind === 'deleted' ? <s>{display.text}</s> : display.text}
      </PopoverTrigger>
      <PopoverContent align="start" initialFocus={inputRef}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <p className="text-sm">
            Orijinal: <strong>{word.text}</strong>
          </p>
          <Input
            aria-label="Düzeltme"
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Boş bırakırsan kelime silinir"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Kaydet
            </Button>
            {isCorrected && (
              <Button
                type="button"
                size="sm"
                variant="neutral"
                onClick={async () => {
                  if (await onRevert(word.id)) setOpen(false)
                }}
              >
                Geri al
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
