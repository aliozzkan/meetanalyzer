import { describe, expect, it } from 'vitest'
import {
  dropIsolatedEchoes,
  expandEchoesBySegment,
  findEchoWordIds,
  normalizeWord,
  type EchoWord
} from './echo'

const WINDOW = 1_500
const word = (id: string, text: string, startMs: number): EchoWord => ({ id, text, startMs })

describe('normalizeWord', () => {
  it('küçük harfe çevirir (Türkçe kurallarıyla) ve noktalamayı atar', () => {
    expect(normalizeWord('Toplantı,')).toBe('toplantı')
    expect(normalizeWord('"Merhaba!"')).toBe('merhaba')
    expect(normalizeWord('IŞIK')).toBe('ışık')
    expect(normalizeWord('İstanbul')).toBe('istanbul')
    expect(normalizeWord('14.30')).toBe('1430')
    expect(normalizeWord('—')).toBe('')
  })
})

describe('findEchoWordIds', () => {
  it('pencere içinde aynı yazılışla system kanalında geçen mic kelimesi yankıdır', () => {
    const echoes = findEchoWordIds(
      [word('m1', 'toplantı', 10_000), word('m2', 'başlıyor', 10_500)],
      [word('s1', 'toplantı', 10_000), word('s2', 'başlıyor', 10_400)],
      WINDOW
    )

    expect([...echoes].sort()).toEqual(['m1', 'm2'])
  })

  it('pencere sınırı: tam sınırda (±1,5 sn) yankı, bir milisaniye dışında gerçek söz', () => {
    const system = [word('s1', 'tamam', 10_000)]

    expect(findEchoWordIds([word('m-in', 'tamam', 11_500)], system, WINDOW).has('m-in')).toBe(true)
    expect(findEchoWordIds([word('m-in', 'tamam', 8_500)], system, WINDOW).has('m-in')).toBe(true)
    expect(findEchoWordIds([word('m-out', 'tamam', 11_501)], system, WINDOW).has('m-out')).toBe(
      false
    )
    expect(findEchoWordIds([word('m-out', 'tamam', 8_499)], system, WINDOW).has('m-out')).toBe(
      false
    )
  })

  it('normalize eşleşme: büyük/küçük harf ve noktalama farkı yankıyı engellemez', () => {
    const echoes = findEchoWordIds(
      [word('m1', 'toplantı', 5_000), word('m2', 'Ankara', 5_300)],
      [word('s1', 'Toplantı,', 5_000), word('s2', 'ankara.', 5_300)],
      WINDOW
    )

    expect([...echoes].sort()).toEqual(['m1', 'm2'])
  })

  it('aynı anda konuşma: Self farklı bir şey söylüyorsa gerçek sözü korunur', () => {
    const echoes = findEchoWordIds(
      [word('m1', 'bütçeyi', 20_000), word('m2', 'onaylıyorum', 20_400)],
      [word('s1', 'raporu', 20_000), word('s2', 'okudum', 20_300)],
      WINDOW
    )

    expect(echoes.size).toBe(0)
  })

  it('aynı anda konuşma: yankı olan kelime atılır, Self’in kendi sözü kalır', () => {
    const echoes = findEchoWordIds(
      [word('m-echo', 'rapor', 30_000), word('m-self', 'katılıyorum', 30_200)],
      [word('s1', 'rapor', 30_050)],
      WINDOW
    )

    expect([...echoes]).toEqual(['m-echo'])
  })

  it('her system kelimesi en fazla bir mic kelimesini yankı yapar', () => {
    const echoes = findEchoWordIds(
      [word('m1', 'evet', 40_000), word('m2', 'evet', 40_600)],
      [word('s1', 'evet', 40_100)],
      WINDOW
    )

    expect(echoes.size).toBe(1)
  })

  it('birden çok aday varsa başlangıcı en yakın olan system kelimesi eşlenir', () => {
    const echoes = findEchoWordIds(
      [word('m1', 'tamam', 50_000), word('m2', 'tamam', 52_800)],
      [word('s-far', 'tamam', 50_900), word('s-near', 'tamam', 52_700)],
      WINDOW
    )

    // m1: yalnızca s-far pencerede (900 ms); m2: yalnızca s-near pencerede (100 ms)
    expect([...echoes].sort()).toEqual(['m1', 'm2'])
  })

  it('yalnızca noktalamadan oluşan kelimeler eşleşmez', () => {
    const echoes = findEchoWordIds([word('m1', '—', 1_000)], [word('s1', '-', 1_000)], WINDOW)

    expect(echoes.size).toBe(0)
  })

  it('kulaklıklı kayıt: system kanalı boşsa hiçbir mic kelimesi atılmaz', () => {
    const echoes = findEchoWordIds(
      [word('m1', 'merhaba', 1_000), word('m2', 'dünya', 1_400)],
      [],
      WINDOW
    )

    expect(echoes.size).toBe(0)
  })
})

describe('expandEchoesBySegment', () => {
  const rule = { minEchoes: 3, minRatio: 0.6 }

  it('yankı baskın segmentin kalan kelimeleri de yankıdır (gerçek kayıttan: "uçlu olduğundan yanlış …")', () => {
    const segment = { wordIds: ['uçlu', 'a', 'b', 'c', 'd', 'e'] }

    const expanded = expandEchoesBySegment([segment], new Set(['a', 'b', 'c', 'd', 'e']), rule)

    expect(expanded.has('uçlu')).toBe(true)
  })

  it('gerçek kayıttan: "Bu soruya şu şekilde bir cevap" (6 kelimeden 4’ü yankı) → "bir cevap" da yankı', () => {
    const segment = { wordIds: ['bu', 'soruya', 'şu', 'şekilde', 'bir', 'cevap'] }

    const expanded = expandEchoesBySegment(
      [segment],
      new Set(['bu', 'soruya', 'şu', 'şekilde']),
      rule
    )

    expect([...expanded].sort()).toEqual(['bir', 'bu', 'cevap', 'soruya', 'şekilde', 'şu'].sort())
  })

  it('az sayıda eşleşme (< minEchoes) segmenti genişletmez: Self’in gerçek sözü korunur', () => {
    // Karşı taraf "evet tamam" dedi; Self "evet tamam katılıyorum" dedi: 2 eşleşme, 3 kelime
    const segment = { wordIds: ['evet', 'tamam', 'katılıyorum'] }

    const expanded = expandEchoesBySegment([segment], new Set(['evet', 'tamam']), rule)

    expect(expanded.has('katılıyorum')).toBe(false)
  })

  it('oran eşiğin altındaysa (yankı azınlıkta) segment genişletilmez', () => {
    const segment = { wordIds: ['a', 'b', 'c', 'x', 'y', 'z', 'w'] }

    const expanded = expandEchoesBySegment([segment], new Set(['a', 'b', 'c']), rule)

    expect(expanded.size).toBe(3)
  })

  it('yankısız segmentlere (Self’in kendi cümleleri) dokunmaz; segmentler birbirinden bağımsızdır', () => {
    const echoSegment = { wordIds: ['e1', 'e2', 'e3', 'e4'] }
    const selfSegment = { wordIds: ['yapma', 'ya'] }

    const expanded = expandEchoesBySegment(
      [echoSegment, selfSegment],
      new Set(['e1', 'e2', 'e3']),
      rule
    )

    expect(expanded.has('e4')).toBe(true)
    expect(expanded.has('yapma')).toBe(false)
    expect(expanded.has('ya')).toBe(false)
  })
})

describe('dropIsolatedEchoes', () => {
  it('tek başına eşleşen kelime yankı sayılmaz; ardışık dizi korunur', () => {
    const segments = [{ wordIds: ['a', 'b', 'c', 'd', 'e'] }]

    const kept = dropIsolatedEchoes(segments, new Set(['a', 'b', 'd']), 2)

    expect([...kept].sort()).toEqual(['a', 'b'])
  })

  it('diziler segmentler arasında birleşmez: önceki segmentin sonu sonraki segmentin başını yankı yapmaz', () => {
    const segments = [{ wordIds: ['x1', 'x2', 'verdim'] }, { wordIds: ['bu', 'benim', 'sesim'] }]

    const kept = dropIsolatedEchoes(segments, new Set(['x1', 'x2', 'verdim', 'bu']), 2)

    expect(kept.has('bu')).toBe(false)
    expect(kept.has('verdim')).toBe(true)
  })

  it('gerçek kayıttan: video "bu" derken Self’in "Bu benim sesim." cümlesinin ilk kelimesi kaybolmaz', () => {
    const mic = [
      { id: 'm-bu', text: 'Bu', startMs: 9_500 },
      { id: 'm-benim', text: 'benim', startMs: 9_550 },
      { id: 'm-sesim', text: 'sesim.', startMs: 9_600 }
    ]
    const system = [
      { id: 's-ve', text: 've', startMs: 9_380 },
      { id: 's-bu', text: 'bu', startMs: 9_520 },
      { id: 's-kapsamda', text: 'kapsamda', startMs: 9_720 }
    ]

    const raw = findEchoWordIds(mic, system, WINDOW)
    const kept = dropIsolatedEchoes([{ wordIds: mic.map((w) => w.id) }], raw, 2)

    expect(raw.has('m-bu')).toBe(true) // ham eşleşme yanlış pozitif verir
    expect(kept.size).toBe(0) // dizi kuralı gerçek sözü korur
  })
})
