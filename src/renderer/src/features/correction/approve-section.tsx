import { useState } from 'react'
import { toast } from 'sonner'
import { countUncorrected } from '@shared/transcript'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { Button } from '@renderer/components/ui/button'
import type { TranscriptApi } from './use-transcript'

interface Props {
  meetingId: string
  api: TranscriptApi
  /** Onay başarılı olunca Meeting listesi yenilensin. */
  onApproved: () => Promise<void>
}

// "Onayla": düzeltilmemiş Suspect Word varsa sayısıyla birlikte sorar. Onay geri alınamaz.
export function ApproveSection({ meetingId, api, onApproved }: Props): React.JSX.Element | null {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!api.transcript) return null
  const uncorrected = countUncorrected(api.transcript)

  async function approve(): Promise<void> {
    setBusy(true)
    const result = await window.api.transcript.approve(meetingId)
    setBusy(false)
    if (!result.ok) toast.error(result.message)
    await onApproved()
  }

  return (
    <div className="flex justify-end">
      <Button onClick={() => setConfirming(true)} disabled={busy}>
        Transcript&apos;i onayla
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {uncorrected > 0
                ? `${uncorrected} Suspect Word düzeltilmedi, yine de onaylıyor musun?`
                : 'Transcript onaylansın mı?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Onaydan sonra metin değiştirilemez ve bu Meeting&apos;in ses kayıtları cihazdan kalıcı
              olarak silinir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => void approve()}>Onayla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
