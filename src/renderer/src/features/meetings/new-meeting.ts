import type { Language, MeetingSummary } from '@shared/meeting'

type MeetingRef = Pick<MeetingSummary, 'id' | 'state'>

/** Recording durumundaki Meeting (aynı anda en fazla bir tane olabilir; bkz. docs/meeting-lifecycle.md). */
export function findOpenMeeting<T extends MeetingRef>(meetings: T[]): T | undefined {
  return meetings.find((meeting) => meeting.state === 'recording')
}

export type NewMeetingShortcutAction =
  { kind: 'start'; language: Language } | { kind: 'go'; meetingId: string }

// ⌘N: Default Language ile yeni Meeting; açık Meeting varsa yenisi başlatılamayacağı için ona gidilir.
export function newMeetingShortcutAction(
  meetings: MeetingRef[],
  defaultLanguage: Language
): NewMeetingShortcutAction {
  const open = findOpenMeeting(meetings)
  return open ? { kind: 'go', meetingId: open.id } : { kind: 'start', language: defaultLanguage }
}
