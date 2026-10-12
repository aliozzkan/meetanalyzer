import { describe, expect, it } from 'vitest'
import { groupMeetingsByDate } from './group-meetings'

// Yerel saatle kurulur; testler çalıştığı makinenin saat diliminden bağımsızdır.
const at = (month: number, day: number, hour = 12, minute = 0): number =>
  new Date(2026, month - 1, day, hour, minute).getTime()

// 12 Ekim 2026, 15:00
const NOW = at(10, 12, 15)

const meeting = (id: string, createdAt: number): { id: string; createdAt: number } => ({
  id,
  createdAt
})

describe('groupMeetingsByDate', () => {
  it('bugünkü Meeting yalnızca "Bugün" grubunda toplanır', () => {
    const groups = groupMeetingsByDate([meeting('a', at(10, 12, 9))], NOW)

    expect(groups).toEqual([{ label: 'Bugün', meetings: [meeting('a', at(10, 12, 9))] }])
  })

  it('gece yarısı bugünü dünden ayırır; Bugün en yeni, Dün sonra gelir', () => {
    const justAfterMidnight = meeting('bugun', at(10, 12, 0, 0))
    const justBeforeMidnight = meeting('dun', at(10, 11, 23, 59))

    const groups = groupMeetingsByDate([justBeforeMidnight, justAfterMidnight], NOW)

    expect(groups).toEqual([
      { label: 'Bugün', meetings: [justAfterMidnight] },
      { label: 'Dün', meetings: [justBeforeMidnight] }
    ])
  })

  it('2–7 gün önce "Son 7 gün", 8–30 gün önce "Son 30 gün" olur', () => {
    const twoDays = meeting('iki', at(10, 10, 9))
    const sevenDays = meeting('yedi', at(10, 5, 9))
    const eightDays = meeting('sekiz', at(10, 4, 9))
    const thirtyDays = meeting('otuz', at(9, 12, 9))

    const groups = groupMeetingsByDate([thirtyDays, eightDays, sevenDays, twoDays], NOW)

    expect(groups).toEqual([
      { label: 'Son 7 gün', meetings: [twoDays, sevenDays] },
      { label: 'Son 30 gün', meetings: [eightDays, thirtyDays] }
    ])
  })

  it('30 günden eskiler ay bazında, en yeni ay üstte gruplanır', () => {
    const lateSeptember = meeting('eylul-gec', at(9, 11, 18)) // 31 gün önce
    const earlySeptember = meeting('eylul-erken', at(9, 2, 8))
    const august = meeting('agustos', at(8, 20, 10))
    const lastYear = meeting('gecen-yil', new Date(2025, 11, 31, 23, 30).getTime())

    const groups = groupMeetingsByDate([lastYear, august, earlySeptember, lateSeptember], NOW)

    expect(groups).toEqual([
      { label: 'Eylül 2026', meetings: [lateSeptember, earlySeptember] },
      { label: 'Ağustos 2026', meetings: [august] },
      { label: 'Aralık 2025', meetings: [lastYear] }
    ])
  })

  it('Meeting yoksa grup da yoktur', () => {
    expect(groupMeetingsByDate([], NOW)).toEqual([])
  })
})
