import { describe, expect, it } from 'vitest'
import type { MeetingState, MeetingSummary } from '@shared/meeting'
import type { RecorderSnapshot } from '../recording/recorder-controller'
import { openMeetingStatus } from './open-meeting-status'

function meeting(id: string, state: MeetingState): Pick<MeetingSummary, 'id' | 'state'> {
  return { id, state }
}

const idle: Pick<RecorderSnapshot, 'state' | 'meetingId' | 'elapsedMs'> = {
  state: 'idle',
  meetingId: null,
  elapsedMs: 0
}

describe('açık Meeting durumu (header ortası, sidebar üst alanı)', () => {
  it('açık Meeting yokken header boş kalır, sidebar Yeni Meeting butonunu gösterir', () => {
    expect(openMeetingStatus([meeting('m1', 'closed'), meeting('m2', 'approved')], idle)).toEqual({
      kind: 'none'
    })
  })

  it("Recording durumunda Meeting varken kayıt alınmıyorsa o Meeting'e dönüş gösterilir", () => {
    expect(openMeetingStatus([meeting('m1', 'closed'), meeting('m2', 'recording')], idle)).toEqual({
      kind: 'open-meeting',
      meetingId: 'm2'
    })
  })

  it("kayıt sürüyorsa süreyle birlikte kayıt pill'i ve durdurma gösterilir", () => {
    const recorder = { state: 'recording', meetingId: 'm2', elapsedMs: 754_000 } as const

    expect(openMeetingStatus([meeting('m2', 'recording')], recorder)).toEqual({
      kind: 'recording',
      meetingId: 'm2',
      elapsedMs: 754_000,
      canStop: true
    })
  })

  it('kayıt bitirilirken pill kalır ama yeniden durdurulamaz', () => {
    expect(
      openMeetingStatus([meeting('m2', 'recording')], {
        state: 'stopping',
        meetingId: 'm2',
        elapsedMs: 754_000
      })
    ).toMatchObject({ kind: 'recording', meetingId: 'm2', canStop: false })
  })

  it("kayıt başlatılırken (ör. mikrofon izni beklenirken) henüz kayıt pill'i gösterilmez", () => {
    expect(
      openMeetingStatus([meeting('m2', 'recording')], {
        state: 'starting',
        meetingId: 'm2',
        elapsedMs: 0
      })
    ).toEqual({ kind: 'open-meeting', meetingId: 'm2' })
  })
})
