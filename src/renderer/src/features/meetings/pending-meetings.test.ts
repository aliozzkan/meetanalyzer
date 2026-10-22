import { describe, expect, it } from 'vitest'
import type { MeetingState, MeetingSummary } from '@shared/meeting'
import { pendingMeetings } from './pending-meetings'

type Ref = Pick<MeetingSummary, 'id' | 'state' | 'createdAt'>

const meeting = (id: string, state: MeetingState, createdAt = 0): Ref => ({ id, state, createdAt })

describe('pendingMeetings (Home > Senden işlem bekleyenler)', () => {
  it('Closed ve Transcribed listelenir; Recording, Transcribing ve Approved listelenmez', () => {
    const meetings = [
      meeting('kayitta', 'recording'),
      meeting('kapandi', 'closed'),
      meeting('dokuluyor', 'transcribing'),
      meeting('duzeltilecek', 'transcribed'),
      meeting('onaylandi', 'approved')
    ]

    expect(pendingMeetings(meetings).map((m) => m.id)).toEqual(['kapandi', 'duzeltilecek'])
  })

  it('en yeni Meeting üstte gelir (sidebar ile aynı sıra); durum sırayı değiştirmez', () => {
    const meetings = [
      meeting('eski', 'transcribed', 100),
      meeting('yeni', 'closed', 300),
      meeting('orta', 'transcribed', 200)
    ]

    expect(pendingMeetings(meetings).map((m) => m.id)).toEqual(['yeni', 'orta', 'eski'])
  })

  it('listeyi yerinde sıralamaz', () => {
    const meetings = [meeting('eski', 'closed', 100), meeting('yeni', 'closed', 200)]

    pendingMeetings(meetings)

    expect(meetings.map((m) => m.id)).toEqual(['eski', 'yeni'])
  })

  it('işlem bekleyen yoksa liste boştur (bölüm gizlenir)', () => {
    expect(pendingMeetings([meeting('a', 'approved'), meeting('b', 'recording')])).toEqual([])
  })
})
