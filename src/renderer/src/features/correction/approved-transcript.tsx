import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SIDE_LABEL, type ApprovedTranscript as Approved } from '@shared/transcript'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'

// Approved Meeting'in dondurulmuş Transcript'i; salt okunur, Correction yok. Sıralı "Sen" / "Diğerleri" blokları
// halinde gösterilir. Side bilgisinden önce onaylananlar tek bir "Sen" bloğudur (yalnızca mikrofon vardı).
export function ApprovedTranscript({ meetingId }: { meetingId: string }): React.JSX.Element {
  const [approved, setApproved] = useState<Approved | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.api.transcript.approved(meetingId).then((result) => {
      if (cancelled) return
      if (result.ok) setApproved(result.value)
      else {
        toast.error(result.message)
        setFailed(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [meetingId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onaylanmış Transcript</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {failed ? (
          <p>Metin yüklenemedi.</p>
        ) : approved === null ? (
          <p>Yükleniyor…</p>
        ) : approved.blocks.length === 0 ? (
          <p>Bu Transcript boş.</p>
        ) : (
          approved.blocks.map((block, index) => (
            <section
              key={index}
              aria-label={SIDE_LABEL[block.side]}
              className="flex flex-col gap-1"
            >
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {SIDE_LABEL[block.side]}
              </span>
              {block.text.split('\n\n').map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex} className="leading-7">
                  {paragraph}
                </p>
              ))}
            </section>
          ))
        )}
      </CardContent>
    </Card>
  )
}
