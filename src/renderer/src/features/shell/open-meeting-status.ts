import type { MeetingSummary } from '@shared/meeting'
import { findOpenMeeting } from '../meetings/new-meeting'
import type { RecorderSnapshot } from '../recording/recorder-controller'

export type OpenMeetingStatus =
  | { kind: 'none' }
  | { kind: 'open-meeting'; meetingId: string }
  /** `canStop`: kayıt bitirilirken pill kalır ama yeniden durdurulamaz. */
  | { kind: 'recording'; meetingId: string; elapsedMs: number; canStop: boolean }

// Açık Meeting durumu (spec: "Header > Orta", "Sidebar > Üst alan"): header'ın ortası pill'i, sidebar'ın üst
// alanı "Yeni Meeting" split button'unu buna göre gösterir. Açık Meeting yokken header boş, split button görünür.
export function openMeetingStatus(
  meetings: Pick<MeetingSummary, 'id' | 'state'>[],
  recorder: Pick<RecorderSnapshot, 'state' | 'meetingId' | 'elapsedMs'>
): OpenMeetingStatus {
  // Başlatma sürerken (ör. mikrofon izni beklenirken) kayıt henüz yoktur; izin reddedilirse hiç olmayabilir.
  if ((recorder.state === 'recording' || recorder.state === 'stopping') && recorder.meetingId) {
    return {
      kind: 'recording',
      meetingId: recorder.meetingId,
      elapsedMs: recorder.elapsedMs,
      canStop: recorder.state === 'recording'
    }
  }
  const open = findOpenMeeting(meetings)
  return open ? { kind: 'open-meeting', meetingId: open.id } : { kind: 'none' }
}
