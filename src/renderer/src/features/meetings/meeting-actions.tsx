import { Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import type { MeetingSummary } from '@shared/meeting'
import { Button } from '@renderer/components/ui/button'
import { DeleteMeetingDialog } from './delete-meeting-dialog'

interface Props {
  meeting: MeetingSummary
  onClose: (id: string) => void
  onRemove: (id: string) => void
  /** Sürmekte olan bir kayıt varken Meeting kapatılamaz; önce kaydı durdurmak gerekir. */
  closeDisabled?: boolean
}

// Kapat / Sil düğmeleri. Recording'i olmayan Meeting kapatılamadığı için
// o durumda yalnızca silme sunulur (docs/meeting-lifecycle.md).
export function MeetingActions({
  meeting,
  onClose,
  onRemove,
  closeDisabled = false
}: Props): React.JSX.Element {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const canClose = meeting.state === 'recording' && meeting.recordingCount > 0
  const canRemove = meeting.state !== 'approved'

  return (
    <div className="flex items-center gap-2">
      {canClose && (
        <Button size="sm" onClick={() => onClose(meeting.id)} disabled={closeDisabled}>
          Meeting&apos;i kapat
        </Button>
      )}
      {canRemove && (
        <Button variant="neutral" size="sm" onClick={() => setConfirmingDelete(true)}>
          <Trash2Icon /> Sil
        </Button>
      )}
      <DeleteMeetingDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onConfirm={() => onRemove(meeting.id)}
      />
    </div>
  )
}
