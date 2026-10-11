import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createTimeMapper,
  findProgress,
  parseVadSegments,
  parseWhisperOutput,
  type ParsedSegment
} from './whisper-parser'

// Gerçek whisper-cli çıktıları (bkz. fixtures/README.md): large-v3-turbo ve tiny modelleriyle, sessizlik
// içeren sentezlenmiş Türkçe/İngilizce seslerden alınmıştır.
function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')
}
function load(name: string): { json: unknown; stderr: string } {
  return { json: JSON.parse(fixture(`${name}.json`)), stderr: fixture(`${name}.stderr.txt`) }
}
function parse(name: string, suspectThreshold = 0.5): ParsedSegment[] {
  const { json, stderr } = load(name)
  return parseWhisperOutput(json, {
    vadSegments: parseVadSegments(stderr),
    suspectThreshold
  })
}
const texts = (segment: ParsedSegment): string[] => segment.words.map((word) => word.text)

describe('parseVadSegments / findProgress', () => {
  it('gerçek stderr’den VAD segmentlerini okur; gürültüyü yok sayar', () => {
    // stderr satırları: orig_start: 3.97, orig_end: 8.13, vad_start: 0.00, vad_end: 4.16 / 11.59, 15.97, 4.36, 8.74
    expect(parseVadSegments(load('tr-gap').stderr)).toEqual([
      { origStartMs: 3970, origEndMs: 8130, vadStartMs: 0, vadEndMs: 4160 },
      { origStartMs: 11590, origEndMs: 15970, vadStartMs: 4360, vadEndMs: 8740 }
    ])
  })

  it('VAD satırı yoksa boş liste verir', () => {
    expect(parseVadSegments('whisper_init: loading model\nmetal: ok\n')).toEqual([])
  })

  it('ilerleme satırlarını ve bittikleri konumu bulur; yarım satır sonraki taramada tamamlanır', () => {
    const text = 'x progress = 25%\nwhisper_print_progress_callback: progress =  5%\ny progress ='

    const first = findProgress(text, 0)
    expect(first.map((hit) => hit.percent)).toEqual([25, 5])
    // yarım satır ('progress =') henüz eşleşmez; tamamlanınca yalnızca yeni kısım taranır
    const completed = text + ' 70%'
    expect(findProgress(completed, first[1].end).map((hit) => hit.percent)).toEqual([70])
    expect(findProgress('başka bir satır', 0)).toEqual([])
  })
})

describe('createTimeMapper', () => {
  // Doğrulama ölçütü: whisper kendi segment sınırlarını kendi eşlemesiyle orijinal zamana çevirir.
  // Bizim tablomuz aynıysa, her segmentin ilk token başlangıcı ve son token bitişi whisper'ın
  // bildirdiği segment zamanlarına eşlenmelidir.
  it.each(['tr-gap', 'en-gap', 'tr-tiny'])(
    '%s: whisper ile birebir aynı eşleme segment sınırlarını yeniden üretir',
    (name) => {
      const { json, stderr } = load(name)
      const mapper = createTimeMapper(parseVadSegments(stderr))
      const segments = (json as { transcription: Segment[] }).transcription

      for (const segment of segments) {
        const first = segment.tokens[0].offsets.from
        const last = segment.tokens[segment.tokens.length - 1].offsets.to
        expect(mapper.whisper(first)).toBe(segment.offsets.from)
        expect(mapper.whisper(last)).toBe(segment.offsets.to)
      }
    }
  )

  it('VAD bilgisi yoksa kimlik eşlemesi uygular', () => {
    const mapper = createTimeMapper([])

    expect([mapper.whisper(1234), mapper.start(1234), mapper.end(1234)]).toEqual([1234, 1234, 1234])
  })

  it('konuşma boşluğuna düşen başlangıç sonraki segmentin başına, bitiş önceki segmentin sonuna çekilir', () => {
    // en-gap: 1. segment vad 0.00-3.97 (orig 4.99-8.96), 2. segment vad 4.17-7.49 (orig 12.93-16.25)
    const mapper = createTimeMapper(parseVadSegments(load('en-gap').stderr))

    expect(mapper.start(4140)).toBe(12930) // 4.14 sn: boşlukta; whisper.cpp 11730'a interpolasyon yapar
    expect(mapper.end(4140)).toBe(8960)
    expect(mapper.whisper(4140)).toBe(11730)
    expect(mapper.start(2000)).toBe(6990) // segmentin içinde: 4.99 + 2.00
  })
})

interface Segment {
  offsets: { from: number; to: number }
  tokens: { offsets: { from: number; to: number } }[]
}

describe('parseWhisperOutput: gerçek İngilizce (en-gap)', () => {
  it('token’ları kelimelere gruplar, noktalamayı önceki kelimeye ekler, özel token’ları atar', () => {
    const [first, second] = parse('en-gap')

    expect(texts(first)).toEqual([
      'The',
      'quarterly',
      'budget',
      'review',
      'is',
      'scheduled',
      'for',
      'Tuesday,',
      'March',
      '12.'
    ])
    expect(texts(second)).toEqual([
      'Please',
      'send',
      'the',
      'final',
      'report',
      'to',
      'Jonathan',
      'Weatherby',
      'before',
      'noon.'
    ])
  })

  it('kelime ve segment zamanları orijinal zaman çizgisindedir', () => {
    const [first, second] = parse('en-gap')

    expect(first.words[0]).toMatchObject({ text: 'The', startMs: 5010 }) // ses 5.0 sn'de başlar
    expect(first.words[9]).toMatchObject({ text: '12.', endMs: 8700 })
    expect(second.words[0]).toMatchObject({ text: 'Please', startMs: 12930 }) // ses 12.94 sn'de başlar
    // 'Weatherby' = ' Weather' (5880-6300) + 'by' (6360-6430) sıkıştırılmış zamanda
    expect(second.words[7]).toMatchObject({ text: 'Weatherby', startMs: 14640, endMs: 15190 })
    // segment zamanları kelimelerden türetilir
    expect([first.startMs, first.endMs]).toEqual([5010, 8700])
    expect([second.startMs, second.endMs]).toEqual([12930, 16080])
  })

  it('çok token’lı kelimenin güveni harf içeren token’ların minimumudur', () => {
    const [, second] = parse('en-gap')

    expect(second.words[7].confidence).toBeCloseTo(0.98, 2) // min(Weather 0.98, by 1.0)
  })
})

describe('parseWhisperOutput: gerçek Türkçe (tr-gap)', () => {
  it('ekleri, kesme işaretini ve rakamları tek kelimede toplar', () => {
    const [first, second] = parse('tr-gap')

    expect(texts(first)).toEqual([
      "Ankara'daki",
      'toplantıya',
      'yarın',
      'saat',
      "14'te",
      'başlayacağız.'
    ])
    expect(texts(second)).toEqual([
      'Ayşe',
      'Hanım',
      've',
      'Çağlar',
      'Bey',
      'geliştirme',
      'ekibinden',
      'gelecek,',
      'değil',
      'mi?'
    ])
    expect(first.words[4].confidence).toBeCloseTo(0.91, 2) // " 14" 0.99, "'t" 0.91, "e" 1.00
  })

  it('segment başında sıfır uzunluklu token’lar olsa da zaman sıkıştırılmış çizgiden düzeltilir', () => {
    const [, second] = parse('tr-gap')

    expect(second.words[0]).toMatchObject({ text: 'Ayşe', startMs: 11630 }) // ses 11.61 sn'de başlar
    expect(second.words[3].text).toBe('Çağlar') // 'Ça' + 'ğ' + 'lar' tek kelime
  })
})

describe('parseWhisperOutput: Suspect Word (tr-tiny, gerçek düşük güvenli çıktı)', () => {
  it('güveni eşiğin altındaki kelimeleri işaretler; noktalama güvene katılmaz', () => {
    const segments = parse('tr-tiny')
    const suspects = segments.flatMap((segment) => segment.words.filter((word) => word.isSuspect))

    expect(suspects.map((word) => word.text)).toEqual([
      'toplantı',
      'saat',
      'tebaşlayacağız.',
      'Ayşe',
      'hanım',
      'çağlar',
      'beye',
      'ekibinden'
    ])
    // "gelecek," : 'gelecek' 0.60 ama ',' 0.21: noktalama sayılmadığı için şüpheli değil
    const gelecek = segments[1].words.find((word) => word.text === 'gelecek,')
    expect(gelecek).toMatchObject({ isSuspect: false })
    expect(gelecek!.confidence).toBeCloseTo(0.6, 2)
    // "tebaşlayacağız." : ' te' 0.24 en düşük harf token'ı
    expect(segments[0].words[5].confidence).toBeCloseTo(0.24, 2)
  })

  it('segment ortasındaki konuşma boşluğundan sonra kelimeler doğru yere eşlenir', () => {
    const [, second] = parse('tr-tiny')

    // 'hanım' sıkıştırılmış çizgide 4540 ms; orijinalde konuşma 11.59 sn'de başlar
    expect(second.words[1]).toMatchObject({ text: 'hanım', startMs: 11770 })
    // ' Ay' sıkıştırılmış 4230 ms'de, konuşma boşluğunda başlar: sonraki segmentin başına çekilir
    expect(second.words[0]).toMatchObject({ text: 'Ayşe', startMs: 11590 })
  })

  it('eşik dahil değildir: tam eşikteki kelime şüpheli sayılmaz; yüksek eşik daha çok kelime işaretler', () => {
    const count = (threshold: number): number =>
      parse('tr-tiny', threshold)
        .flatMap((segment) => segment.words)
        .filter((word) => word.isSuspect).length

    expect(count(0.5)).toBe(8)
    expect(count(0.9)).toBeGreaterThan(count(0.5))
    expect(count(0.0)).toBe(0)
  })
})

describe('parseWhisperOutput: sentetik uç durumlar', () => {
  const token = (
    text: string,
    p: number,
    offsets?: { from: number; to: number }
  ): Record<string, unknown> => ({ text, p, ...(offsets ? { offsets } : {}) })
  const output = (tokens: Record<string, unknown>[]): unknown => ({
    transcription: [{ offsets: { from: 1000, to: 2000 }, text: '', tokens }]
  })
  const options = { vadSegments: [], suspectThreshold: 0.5 }

  it('yalnızca noktalamadan oluşan kelime hiçbir zaman şüpheli değildir', () => {
    const [segment] = parseWhisperOutput(
      output([
        token(' evet', 0.9, { from: 0, to: 100 }),
        token(' -', 0.05, { from: 100, to: 120 }),
        token(' hayır', 0.9, { from: 120, to: 300 })
      ]),
      options
    )

    expect(texts(segment)).toEqual(['evet', '-', 'hayır'])
    expect(segment.words[1]).toMatchObject({ isSuspect: false, confidence: 0.05 })
  })

  it('zamanı olmayan token’lar komşu zamanlardan doldurulur; kimlik eşlemesi uygulanır', () => {
    const [segment] = parseWhisperOutput(
      output([
        token(' ev', 0.9, { from: 100, to: 200 }),
        token('de', 0.9), // zaman yok
        token(' var', 0.9, { from: 300, to: 400 })
      ]),
      options
    )

    expect(segment.words[0]).toMatchObject({ text: 'evde', startMs: 100, endMs: 200 })
    expect(segment.words[1]).toMatchObject({ text: 'var', startMs: 300, endMs: 400 })
  })

  it('güveni tam eşiğe eşit olan kelime şüpheli sayılmaz, eşiğin hemen altındaki sayılır', () => {
    const [segment] = parseWhisperOutput(
      output([
        token(' tam', 0.5, { from: 0, to: 100 }),
        token(' altı', 0.499, { from: 100, to: 200 })
      ]),
      options
    )

    expect(segment.words.map((word) => word.isSuspect)).toEqual([false, true])
  })

  it('yalnızca boşluktan oluşan token boş kelime üretmez', () => {
    const [segment] = parseWhisperOutput(
      output([
        token(' evet', 0.9, { from: 0, to: 100 }),
        token(' ', 0.9, { from: 100, to: 110 }),
        token(' hayır', 0.9, { from: 110, to: 300 })
      ]),
      options
    )

    expect(texts(segment)).toEqual(['evet', 'hayır'])
  })

  it('metni olmayan ya da yalnızca özel token içeren segment boş kelime listesi verir', () => {
    const [segment] = parseWhisperOutput(
      output([
        token('[_BEG_]', 0.9, { from: 0, to: 0 }),
        token('[_TT_100]', 0.1, { from: 0, to: 0 })
      ]),
      options
    )

    expect(segment.words).toEqual([])
    expect([segment.startMs, segment.endMs]).toEqual([1000, 2000]) // whisper'ın segment zamanına döner
  })

  it('beklenmeyen çıktı biçimi anlaşılır bir hatayla reddedilir', () => {
    expect(() => parseWhisperOutput({ foo: 1 }, options)).toThrow(
      expect.objectContaining({ code: 'invalid-output' })
    )
    expect(() => parseWhisperOutput(null, options)).toThrow(
      expect.objectContaining({ code: 'invalid-output' })
    )
  })
})
