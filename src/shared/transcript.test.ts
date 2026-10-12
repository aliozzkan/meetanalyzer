import { describe, expect, it } from 'vitest'
import {
  composeApprovedText,
  countUncorrected,
  wordDisplay,
  type Transcript,
  type TranscriptWord
} from './transcript'

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

describe('composeApprovedText', () => {
  const recording = (
    id: string,
    words: Partial<TranscriptWord>[]
  ): Transcript['recordings'][0] => ({
    id,
    segments: [{ id: `${id}-s`, words: words.map((w, i) => word({ id: `${id}${i}`, ...w })) }]
  })
  const compose = (...recordings: Transcript['recordings']): string =>
    composeApprovedText({ meetingId: 'm', recordings })

  it('kelimeleri sırayla birleştirir; Correction varsa onun metnini kullanır', () => {
    expect(
      compose(
        recording('r', [
          { text: 'Merhaba,', isSuspect: false },
          { text: 'wrold', corrected: 'dünya' },
          { text: 'nasılsın?', isSuspect: false }
        ])
      )
    ).toBe('Merhaba, dünya nasılsın?')
  })

  it('çok kelimeli Correction olduğu gibi girer, iç boşluklar normalize edilir', () => {
    expect(
      compose(recording('r', [{ text: 'a', isSuspect: false }, { corrected: 'big   new\nworld' }]))
    ).toBe('a big new world')
  })

  it('boş Correction kelimeyi düşürür ve fazladan boşluk bırakmaz', () => {
    expect(
      compose(
        recording('r', [
          { text: 'bir', isSuspect: false },
          { corrected: '' },
          { text: 'iki', isSuspect: false }
        ])
      )
    ).toBe('bir iki')
  })

  it('noktalama kelimeye bitişik kalır; Correction noktalamayı da değiştirebilir', () => {
    expect(
      compose(
        recording('r', [
          { text: 'gelecek,', isSuspect: false },
          { text: 'tamam.', corrected: 'tamam!' }
        ])
      )
    ).toBe('gelecek, tamam!')
  })

  it("Recording'ler arasına paragraf ayrımı koyar; tamamen silinen Recording paragraf bırakmaz", () => {
    expect(
      compose(
        recording('r1', [{ text: 'birinci', isSuspect: false }]),
        recording('r2', [{ corrected: '' }]),
        recording('r3', [{ text: 'üçüncü', isSuspect: false }])
      )
    ).toBe('birinci\n\nüçüncü')
  })

  it('segmentler aynı paragrafta birleşir', () => {
    const transcript: Transcript = {
      meetingId: 'm',
      recordings: [
        {
          id: 'r',
          segments: [
            { id: 's1', words: [word({ text: 'bir', isSuspect: false })] },
            { id: 's2', words: [word({ text: 'iki', isSuspect: false })] }
          ]
        }
      ]
    }

    expect(composeApprovedText(transcript)).toBe('bir iki')
  })
})
