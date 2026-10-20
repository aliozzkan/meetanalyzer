import { describe, expect, it } from 'vitest'
import type { MeetingState, MeetingSummary } from '@shared/meeting'
import { newMeetingShortcutAction } from './new-meeting'

function meeting(id: string, state: MeetingState): Pick<MeetingSummary, 'id' | 'state'> {
  return { id, state }
}

describe('⌘N (Yeni Meeting kısayolu)', () => {
  it('açık Meeting yoksa Default Language ile yeni Meeting başlatır', () => {
    expect(newMeetingShortcutAction([meeting('m1', 'transcribed')], 'en')).toEqual({
      kind: 'start',
      language: 'en'
    })
  })

  it('açık Meeting varken yeni Meeting oluşturmaz, açık olana gider', () => {
    expect(
      newMeetingShortcutAction([meeting('m1', 'closed'), meeting('m2', 'recording')], 'en')
    ).toEqual({ kind: 'go', meetingId: 'm2' })
  })
})
