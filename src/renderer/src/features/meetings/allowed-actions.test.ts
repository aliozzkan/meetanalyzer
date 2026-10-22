import { describe, expect, it } from 'vitest'
import { allowedActions } from './allowed-actions'

// Beklenenler docs/meeting-lifecycle.md tablosundan ("Kullanıcının yapabildiği"); Title her durumda değişir.
describe('allowedActions', () => {
  it("Recording'i olan açık Meeting yeniden adlandırılır, kapatılır, silinir", () => {
    expect(allowedActions({ state: 'recording', recordingCount: 1 })).toEqual([
      'rename',
      'close',
      'remove'
    ])
  })

  it("Recording'i olmayan açık Meeting kapatılamaz; yalnızca yeniden adlandırılır ve silinir", () => {
    expect(allowedActions({ state: 'recording', recordingCount: 0 })).toEqual(['rename', 'remove'])
  })

  it('Closed Meeting metne dökülebilir', () => {
    expect(allowedActions({ state: 'closed', recordingCount: 2 })).toEqual([
      'rename',
      'transcribe',
      'remove'
    ])
  })

  it('Transcribing ve Transcribed Meeting yalnızca yeniden adlandırılır ve silinir', () => {
    expect(allowedActions({ state: 'transcribing', recordingCount: 2 })).toEqual([
      'rename',
      'remove'
    ])
    expect(allowedActions({ state: 'transcribed', recordingCount: 2 })).toEqual([
      'rename',
      'remove'
    ])
  })

  it('Approved Meeting silinemez; yalnızca yeniden adlandırılır', () => {
    expect(allowedActions({ state: 'approved', recordingCount: 2 })).toEqual(['rename'])
  })
})
