import { format } from 'date-fns'
import type { MeetingSummary } from '@shared/meeting'

// Sidebar satırının adı: Title, yoksa Meeting'in başladığı saat (spec: "Sidebar > Meeting listesi").
export function meetingLabel(meeting: Pick<MeetingSummary, 'title' | 'createdAt'>): string {
  return meeting.title ?? `${format(meeting.createdAt, 'HH:mm')} Meeting'i`
}
