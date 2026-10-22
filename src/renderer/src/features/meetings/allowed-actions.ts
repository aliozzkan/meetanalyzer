import type { MeetingSummary } from '@shared/meeting'

export type MeetingAction = 'rename' | 'close' | 'transcribe' | 'remove'

// Meeting'in durumunda geçerli aksiyonlar, menüde görünecekleri sırayla (docs/meeting-lifecycle.md).
// Detaydaki düğmeler ve sidebar satır menüsü aynı kuralı kullanır. Recording'i olmayan Meeting
// kapatılamadığı için o durumda yalnızca silme sunulur; Title her durumda değişir.
export function allowedActions(
  meeting: Pick<MeetingSummary, 'state' | 'recordingCount'>
): MeetingAction[] {
  const actions: MeetingAction[] = ['rename']
  if (meeting.state === 'recording' && meeting.recordingCount > 0) actions.push('close')
  if (meeting.state === 'closed') actions.push('transcribe')
  if (meeting.state !== 'approved') actions.push('remove')
  return actions
}
