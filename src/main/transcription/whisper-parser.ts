import { WHISPER_VAD_SAMPLES_OVERLAP_S } from '../config'
import { TranscriptionError } from './errors'

// --- stderr: ilerleme ve VAD segment bilgisi -----------------------------------------------------

// whisper.cpp, VAD açıkken konuşma segmentlerini sessizlikleri çıkarılmış sese birleştirir ve her segment
// için orijinal ve sıkıştırılmış (vad) zamanı stderr'e yazar. Segment zamanları orijinal çizgiye çevrilir
// ama token zamanları çevrilmez; bu bilgi kelime zamanlarını düzeltmek için gerekir.
export interface VadSegment {
  origStartMs: number
  origEndMs: number
  vadStartMs: number
  vadEndMs: number
}

const VAD_LINE =
  /vad_segment_info: orig_start: ([\d.]+), orig_end: ([\d.]+), vad_start: ([\d.]+), vad_end: ([\d.]+)/g
const PROGRESS_LINE = /progress =\s*(\d+)%/g

const toMs = (seconds: string): number => Math.round(parseFloat(seconds) * 1000)

export function parseVadSegments(stderr: string): VadSegment[] {
  return [...stderr.matchAll(VAD_LINE)].map((match) => ({
    origStartMs: toMs(match[1]),
    origEndMs: toMs(match[2]),
    vadStartMs: toMs(match[3]),
    vadEndMs: toMs(match[4])
  }))
}

// Metnin `fromIndex`'ten sonrasındaki tamamlanmış ilerleme satırları ve bittikleri konum. Satır iki parçada
// geldiyse (henüz '%' yoksa) eşleşmez; sonraki taramada tamamlanır.
export function findProgress(text: string, fromIndex: number): { percent: number; end: number }[] {
  return [...text.slice(fromIndex).matchAll(PROGRESS_LINE)].map((match) => ({
    percent: Number(match[1]),
    end: fromIndex + (match.index ?? 0) + match[0].length
  }))
}

// --- zaman eşlemesi: sıkıştırılmış (VAD) çizgi -> orijinal çizgi ----------------------------------

// Segmentler arasına eklenen örtüşme (santisaniye). Değeri whisper'a `--vad-samples-overlap` ile biz veririz
// (bkz. whisper-args.ts), böylece tablo whisper varsayılanına bağlı kalmaz. Sessizlik ise aynı uzunluktadır.
const VAD_SAMPLES_OVERLAP_CS = Math.round(WHISPER_VAD_SAMPLES_OVERLAP_S * 100)

export interface TimeMapper {
  /** whisper.cpp'nin kendi eşlemesiyle birebir aynı (boşlukta doğrusal interpolasyon). Doğrulama içindir. */
  whisper: (processedMs: number) => number
  /** Kelime başlangıcı: konuşma boşluğuna düşerse sonraki segmentin başına çekilir. */
  start: (processedMs: number) => number
  /** Kelime bitişi: konuşma boşluğuna düşerse önceki segmentin sonuna çekilir. */
  end: (processedMs: number) => number
}

interface MapPoint {
  processed: number
  original: number
}

export function createTimeMapper(vadSegments: VadSegment[]): TimeMapper {
  if (vadSegments.length === 0) {
    const identity = (ms: number): number => ms
    return { whisper: identity, start: identity, end: identity }
  }

  const cs = (ms: number): number => Math.round(ms / 10)
  const segments = vadSegments.map((segment) => ({
    origStart: cs(segment.origStartMs),
    origEnd: cs(segment.origEndMs),
    vadStart: cs(segment.vadStartMs),
    vadEnd: cs(segment.vadEndMs)
  }))

  // whisper.cpp tablosu: her segmentin başı ve sonu; segmentler arasında örtüşmenin bittiği ve
  // sonraki segmentin başladığı noktalar. İşlenmiş zamana göre sıralı, yinelenenler atılmış.
  const points: MapPoint[] = []
  segments.forEach((segment, i) => {
    points.push({ processed: segment.vadStart, original: segment.origStart })
    points.push({ processed: segment.vadEnd, original: segment.origEnd })
    const next = segments[i + 1]
    if (next) {
      points.push({ processed: segment.vadEnd + VAD_SAMPLES_OVERLAP_CS, original: segment.origEnd })
      points.push({ processed: next.vadStart, original: next.origStart })
    }
  })
  points.sort((a, b) => a.processed - b.processed)
  const table = points.filter((point, i) => i === 0 || point.processed !== points[i - 1].processed)

  function whisperCs(processed: number): number {
    if (processed <= table[0].processed) return table[0].original
    const last = table[table.length - 1]
    if (processed >= last.processed) return last.original
    const upperIndex = table.findIndex((point) => point.processed >= processed)
    const upper = table[upperIndex]
    if (upper.processed === processed) return upper.original
    const lower = table[upperIndex - 1]
    const processedDiff = upper.processed - lower.processed
    if (processedDiff === 0) return lower.original
    const offset = processed - lower.processed
    return lower.original + Math.trunc((offset * (upper.original - lower.original)) / processedDiff)
  }

  // Konuşma boşluğu: bir segmentin sonu ile sonrakinin başı arasındaki (açık) aralık. Segment sonundaki
  // 0.1 sn'lik örtüşme de buna dahildir: gerçek veride bir sonraki cümlenin ilk kelimesi sık sık VAD
  // başlangıcından 100-200 ms önce (örtüşmeye) damgalanır; onu önceki segmentin sonuna eşlemek saniyeler
  // kaydırır, sonraki segmentin başına çekmek doğru yere indirir (bkz. tr-tiny fixture, ADR-0006).
  function gapAfter(
    processed: number
  ): { prevOriginEnd: number; nextOriginStart: number } | undefined {
    for (let i = 0; i < segments.length - 1; i++) {
      if (processed > segments[i].vadEnd && processed < segments[i + 1].vadStart) {
        return { prevOriginEnd: segments[i].origEnd, nextOriginStart: segments[i + 1].origStart }
      }
    }
    return undefined
  }

  return {
    whisper: (ms) => whisperCs(cs(ms)) * 10,
    start: (ms) => (gapAfter(cs(ms))?.nextOriginStart ?? whisperCs(cs(ms))) * 10,
    end: (ms) => (gapAfter(cs(ms))?.prevOriginEnd ?? whisperCs(cs(ms))) * 10
  }
}

// --- -ojf JSON -> segmentler ve kelimeler ---------------------------------------------------------

export interface ParsedWord {
  text: string
  startMs: number
  endMs: number
  /** Kelimenin harf/rakam içeren token'larının en düşük olasılığı. */
  confidence: number
  isSuspect: boolean
}

export interface ParsedSegment {
  startMs: number
  endMs: number
  words: ParsedWord[]
}

export interface ParseOptions {
  vadSegments: VadSegment[]
  /** Güveni bunun altındaki kelime Suspect Word'dür (eşitlik şüpheli sayılmaz). */
  suspectThreshold: number
}

interface RawToken {
  text: string
  p: number
  start?: number
  end?: number
}

// Özel token'lar köşeli parantezli: [_BEG_], [_TT_186] (zaman damgası), [_EOT_] …
const SPECIAL_TOKEN = /^\[_[^\]]*\]$/
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

function invalid(message: string): TranscriptionError {
  return new TranscriptionError('invalid-output', `Beklenmeyen whisper çıktısı: ${message}`)
}

export function parseWhisperOutput(json: unknown, options: ParseOptions): ParsedSegment[] {
  const root = json as { transcription?: unknown } | null
  if (!root || !Array.isArray(root.transcription)) throw invalid('"transcription" listesi yok')

  const mapper = createTimeMapper(options.vadSegments)
  return root.transcription.map((raw, index) => parseSegment(raw, index, mapper, options))
}

function parseSegment(
  raw: unknown,
  index: number,
  mapper: TimeMapper,
  options: ParseOptions
): ParsedSegment {
  const segment = raw as {
    offsets?: { from?: unknown; to?: unknown }
    tokens?: unknown
  }
  if (
    typeof segment?.offsets?.from !== 'number' ||
    typeof segment.offsets.to !== 'number' ||
    !Array.isArray(segment.tokens)
  ) {
    throw invalid(`segment ${index} -ojf biçiminde değil (zaman ya da token listesi yok)`)
  }
  const whisperStart = segment.offsets.from
  const whisperEnd = segment.offsets.to

  const tokens = (
    segment.tokens as { text?: unknown; p?: unknown; offsets?: { from: number; to: number } }[]
  )
    .map((token): RawToken => {
      if (typeof token?.text !== 'string' || typeof token.p !== 'number') {
        throw invalid(`segment ${index} içinde metni ya da olasılığı olmayan token`)
      }
      return { text: token.text, p: token.p, start: token.offsets?.from, end: token.offsets?.to }
    })
    .filter((token) => !SPECIAL_TOKEN.test(token.text) && token.text.trim() !== '')

  fillMissingTimes(tokens)

  const words = groupWords(tokens, mapper, options.suspectThreshold, whisperStart, whisperEnd)
  return {
    startMs: words.length > 0 ? words[0].startMs : whisperStart,
    endMs: words.length > 0 ? words[words.length - 1].endMs : whisperEnd,
    words
  }
}

// Zamanı olmayan token'lar önceki token'ın bitişinden (ya da sonrakinin başlangıcından) doldurulur.
function fillMissingTimes(tokens: RawToken[]): void {
  let previousEnd: number | undefined
  for (const token of tokens) {
    token.start ??= previousEnd
    token.end ??= token.start
    previousEnd = token.end ?? previousEnd
  }
  let nextStart: number | undefined
  for (let i = tokens.length - 1; i >= 0; i--) {
    tokens[i].end ??= nextStart
    tokens[i].start ??= tokens[i].end
    nextStart = tokens[i].start ?? nextStart
  }
}

// Boşlukla başlayan token yeni kelime başlatır; boşluksuz token (ek, kesme işareti, noktalama) önceki
// kelimeye eklenir.
function groupWords(
  tokens: RawToken[],
  mapper: TimeMapper,
  threshold: number,
  fallbackStart: number,
  fallbackEnd: number
): ParsedWord[] {
  const groups: RawToken[][] = []
  for (const token of tokens) {
    if (token.text.startsWith(' ') || groups.length === 0) groups.push([token])
    else groups[groups.length - 1].push(token)
  }

  return groups.map((group) => {
    const text = group
      .map((token) => token.text)
      .join('')
      .trim()
    const lettered = group.filter((token) => HAS_LETTER_OR_DIGIT.test(token.text))
    const confidence = Math.min(...(lettered.length > 0 ? lettered : group).map((token) => token.p))

    const first = group[0].start
    const last = group[group.length - 1].end
    const timed = first !== undefined && last !== undefined
    const startMs = timed ? mapper.start(first) : fallbackStart
    const endMs = timed ? Math.max(startMs, mapper.end(last)) : fallbackEnd

    return {
      text,
      startMs,
      endMs,
      confidence,
      // Yalnızca noktalamadan oluşan kelime (örn. " -") yanlış duyulmuş sayılmaz.
      isSuspect: lettered.length > 0 && confidence < threshold
    }
  })
}
