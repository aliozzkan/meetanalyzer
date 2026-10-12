import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'

// Approved Meeting'in dondurulmuş metni; salt okunur, Correction yok. Recording'ler boş satırla ayrılmıştır.
export function ApprovedTranscript({ meetingId }: { meetingId: string }): React.JSX.Element {
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.transcript.approvedText(meetingId).then((result) => {
      if (cancelled) return
      if (result.ok) setText(result.value)
      else toast.error(result.message)
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
        {text === null ? (
          <p>Yükleniyor…</p>
        ) : text === '' ? (
          <p>Bu Transcript boş.</p>
        ) : (
          text.split('\n\n').map((paragraph, index) => (
            <p key={index} className="leading-7">
              {paragraph}
            </p>
          ))
        )}
      </CardContent>
    </Card>
  )
}
