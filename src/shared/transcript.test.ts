import { describe, expect, it } from 'vitest'
import { countUncorrected, wordDisplay, type Transcript, type TranscriptWord } from './transcript'

const word = (overrides: Partial<TranscriptWord> = {}): TranscriptWord => ({
  id: 'w',
  text: 'wrold',
  isSuspect: true,
  corrected: null,
  ...overrides
})

describe('wordDisplay', () => {
  it('Correction yoksa ham metni gösterir', () => {
    expect(wordDisplay(word())).toEqual({ kind: 'raw', text: 'wrold' })
  })

  it('çok kelimeli Correction olduğu gibi gösterilir', () => {
    expect(wordDisplay(word({ corrected: 'big new world' }))).toEqual({
      kind: 'corrected',
      text: 'big new world'
    })
  })

  it('boş Correction kelimeyi silinmiş gösterir ve ham metni korur', () => {
    expect(wordDisplay(word({ corrected: '' }))).toEqual({ kind: 'deleted', text: 'wrold' })
  })
})

describe('countUncorrected', () => {
  it("yalnızca düzeltilmemiş Suspect Word'leri sayar; boş Correction düzeltilmiş sayılır", () => {
    const transcript: Transcript = {
      meetingId: 'm',
      recordings: [
        {
          id: 'r1',
          segments: [
            {
              id: 's1',
              words: [
                word({ id: '1' }),
                word({ id: '2', corrected: '' }),
                word({ id: '3', corrected: 'x' }),
                word({ id: '4', isSuspect: false })
              ]
            }
          ]
        },
        { id: 'r2', segments: [{ id: 's2', words: [word({ id: '5' })] }] }
      ]
    }

    expect(countUncorrected(transcript)).toBe(2)
  })
})
