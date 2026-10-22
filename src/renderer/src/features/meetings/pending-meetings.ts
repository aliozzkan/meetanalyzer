import type { MeetingState, MeetingSummary } from '@shared/meeting'

// Kullanıcıdan işlem bekleyen durumlar (spec: "Home"): Closed metne dökülmeyi, Transcribed düzeltme/onayı
// bekler. Analysis durumları kodda gelince buraya eklenir.
const PENDING_STATES: ReadonlySet<MeetingState> = new Set(['closed', 'transcribed'])

/** Home'daki "Senden işlem bekleyenler" listesi; sidebar gibi en yeni Meeting üstte. Boşsa bölüm gizlenir. */
export function pendingMeetings<T extends Pick<MeetingSummary, 'state' | 'createdAt'>>(
  meetings: T[]
): T[] {
  return meetings
    .filter((meeting) => PENDING_STATES.has(meeting.state))
    .sort((a, b) => b.createdAt - a.createdAt)
}
