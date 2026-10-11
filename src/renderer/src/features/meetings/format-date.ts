import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

export function formatMeetingDate(timestamp: number): string {
  return format(timestamp, 'd MMMM yyyy HH:mm', { locale: tr })
}
