import { describe, expect, it } from 'vitest'
import {
  composeApprovedBlocks,
  composeApprovedText,
  countUncorrected,
  groupIntoBlocks,
  wordDisplay,
  type Side,
  type Transcript,
  type TranscriptSegment,
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
              side: 'self',
              words: [
                word({ id: '1' }),
                word({ id: '2', corrected: '' }),
                word({ id: '3', corrected: 'x' }),
                word({ id: '4', isSuspect: false })
              ]
            }
          ]
        },
        { id: 'r2', segments: [{ id: 's2', side: 'self', words: [word({ id: '5' })] }] }
      ]
    }

    expect(countUncorrected(transcript)).toBe(2)
  })
})

describe('composeApprovedText', () => {
  const recording = (
    id: string,
    words: Partial<TranscriptWord>[],
    side: Side = 'self'
  ): Transcript['recordings'][0] => ({
    id,
    segments: [{ id: `${id}-s`, side, words: words.map((w, i) => word({ id: `${id}${i}`, ...w })) }]
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
    ).toBe('Sen: Merhaba, dünya nasılsın?')
  })

  it('boş Correction kelimeyi düşürür; boşluklar tek boşluğa iner', () => {
    expect(
      compose(
        recording('r', [
          { text: ' bir ', isSuspect: false },
          { text: 'wrold', corrected: '' },
          { text: 'iki', isSuspect: false }
        ])
      )
    ).toBe('Sen: bir iki')
  })

  it('noktalama kelimeye bitişik kalır; Correction noktalamayı da değiştirebilir', () => {
    expect(
      compose(
        recording('r', [
          { text: 'gelecek,', isSuspect: false },
          { text: 'tamam.', corrected: 'tamam!' }
        ])
      )
    ).toBe('Sen: gelecek, tamam!')
  })

  it("Recording'ler ayrı bloktur (Recording sınırında birleşmez); tamamen silinen blok bırakılmaz", () => {
    expect(
      compose(
        recording('r1', [{ text: 'birinci', isSuspect: false }]),
        recording('r2', [{ corrected: '' }]),
        recording('r3', [{ text: 'üçüncü', isSuspect: false }])
      )
    ).toBe('Sen: birinci\n\nSen: üçüncü')
  })

  it('aynı Recording içinde ardışık aynı Side’lı segmentler tek blokta birleşir', () => {
    const transcript: Transcript = {
      meetingId: 'm',
      recordings: [
        {
          id: 'r',
          segments: [
            { id: 's1', side: 'self', words: [word({ text: 'bir', isSuspect: false })] },
            { id: 's2', side: 'self', words: [word({ text: 'iki', isSuspect: false })] }
          ]
        }
      ]
    }

    expect(composeApprovedText(transcript)).toBe('Sen: bir iki')
  })

  it('Side değişince yeni blok başlar; düz metin “Sen: …” / “Diğerleri: …” bloklarıdır', () => {
    const transcript: Transcript = {
      meetingId: 'm',
      recordings: [
        {
          id: 'r',
          segments: [
            { id: 's1', side: 'others', words: [word({ text: 'Merhaba', isSuspect: false })] },
            { id: 's2', side: 'self', words: [word({ text: 'Selam', isSuspect: false })] },
            { id: 's3', side: 'self', words: [word({ text: 'nasılsınız', isSuspect: false })] },
            { id: 's4', side: 'others', words: [word({ text: 'İyiyiz', isSuspect: false })] }
          ]
        }
      ]
    }

    expect(composeApprovedBlocks(transcript)).toEqual([
      { side: 'others', text: 'Merhaba' },
      { side: 'self', text: 'Selam nasılsınız' },
      { side: 'others', text: 'İyiyiz' }
    ])
    expect(composeApprovedText(transcript)).toBe(
      'Diğerleri: Merhaba\n\nSen: Selam nasılsınız\n\nDiğerleri: İyiyiz'
    )
  })
})

describe('groupIntoBlocks', () => {
  const segment = (id: string, side: Side): TranscriptSegment => ({ id, side, words: [] })

  it('ardışık aynı Side’lı segmentleri bloklar; boş listeden boş liste çıkar', () => {
    expect(groupIntoBlocks([])).toEqual([])
    expect(
      groupIntoBlocks([
        segment('a', 'self'),
        segment('b', 'self'),
        segment('c', 'others'),
        segment('d', 'self')
      ]).map((block) => [block.side, block.segments.map((s) => s.id)])
    ).toEqual([
      ['self', ['a', 'b']],
      ['others', ['c']],
      ['self', ['d']]
    ])
  })
})
