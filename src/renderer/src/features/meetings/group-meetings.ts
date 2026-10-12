import { differenceInCalendarDays, format } from 'date-fns'
import { tr } from 'date-fns/locale'

export interface MeetingGroup<T> {
  label: string
  meetings: T[]
}

function labelFor(createdAt: number, now: number): string {
  const daysAgo = differenceInCalendarDays(now, createdAt)
  if (daysAgo <= 0) return 'Bugün'
  if (daysAgo === 1) return 'Dün'
  if (daysAgo <= 7) return 'Son 7 gün'
  if (daysAgo <= 30) return 'Son 30 gün'
  return format(createdAt, 'LLLL yyyy', { locale: tr })
}

export function groupMeetingsByDate<T extends { createdAt: number }>(
  meetings: T[],
  now: number
): MeetingGroup<T>[] {
  const groups: MeetingGroup<T>[] = []
  const newestFirst = [...meetings].sort((a, b) => b.createdAt - a.createdAt)
  for (const meeting of newestFirst) {
    const label = labelFor(meeting.createdAt, now)
    const last = groups[groups.length - 1]
    if (last?.label === label) last.meetings.push(meeting)
    else groups.push({ label, meetings: [meeting] })
  }
  return groups
}
