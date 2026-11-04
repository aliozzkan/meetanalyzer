// Kulaklıksız toplantıda hoparlörden mikrofona sızan ses `mic` kanalında da transcribe edilir. Ses seviyesinde yankı
// giderme yerine Transcript seviyesinde tekilleştirilir (ADR-0007): `mic` kelimesi, pencere içinde aynı normalize
// yazılışla bir `system` kelimesiyle eşleşirse yankıdır. Ham whisper çıktısı (`words`) değişmez; atılan kelimeler
// yalnızca Transcript'ten çıkar.

export interface EchoWord {
  id: string
  text: string
  /** Kelimenin kendi kanalının dosyasındaki başlangıcı; iki kanal aynı anda başladığı için karşılaştırılabilir. */
  startMs: number
}

// Küçük harf (Türkçe kurallarıyla) ve harf/rakam dışındaki her şey (noktalama, tırnak) atılır.
export function normalizeWord(text: string): string {
  return text.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '')
}

// Yankı sayılan `mic` kelimelerinin kimlikleri. Her `system` kelimesi en fazla bir `mic` kelimesini yankı yapabilir:
// karşı tarafın bir kez söylediği kelimeyi sen art arda iki kez söylersen yalnızca biri atılır. Eşleşmede başlangıçları
// en yakın olan `system` kelimesi seçilir. Yalnızca noktalamadan oluşan kelimeler eşleşmez.
export function findEchoWordIds(
  micWords: EchoWord[],
  systemWords: EchoWord[],
  windowMs: number
): Set<string> {
  const candidates = new Map<string, { startMs: number; used: boolean }[]>()
  for (const word of systemWords) {
    const key = normalizeWord(word.text)
    if (key === '') continue
    const list = candidates.get(key) ?? []
    list.push({ startMs: word.startMs, used: false })
    candidates.set(key, list)
  }

  const echoes = new Set<string>()
  for (const word of [...micWords].sort((a, b) => a.startMs - b.startMs)) {
    const list = candidates.get(normalizeWord(word.text))
    if (!list) continue
    let best: { startMs: number; used: boolean } | undefined
    for (const candidate of list) {
      if (candidate.used || Math.abs(candidate.startMs - word.startMs) > windowMs) continue
      if (
        !best ||
        Math.abs(candidate.startMs - word.startMs) < Math.abs(best.startMs - word.startMs)
      ) {
        best = candidate
      }
    }
    if (best) {
      best.used = true
      echoes.add(word.id)
    }
  }
  return echoes
}

// Segment içinde tek başına kalan eşleşmeleri eler: yankı cümle olarak sızar, bu yüzden bir `mic` kelimesi yalnızca
// segmentinde en az `minRun` ardışık kelimelik bir yankı dizisinin parçasıysa yankıdır. Tek başına eşleşme çoğunlukla
// rastlantıdır ("bu", "ve", "bir" gibi ortak kelimeler): Self'in gerçek sözünün ilk kelimesi, karşı tarafın o sıradaki
// aynı kelimesiyle eşleşip kaybolmasın.
export function dropIsolatedEchoes(
  segments: { wordIds: string[] }[],
  echoes: Set<string>,
  minRun: number
): Set<string> {
  const kept = new Set<string>()
  for (const { wordIds } of segments) {
    let run: string[] = []
    const flush = (): void => {
      if (run.length >= minRun) for (const id of run) kept.add(id)
      run = []
    }
    for (const id of wordIds) {
      if (echoes.has(id)) run.push(id)
      else flush()
    }
    flush()
  }
  return kept
}

// Yankı baskın olan mikrofon segmentlerinin kalan kelimelerini de yankı sayar. Yankılı ses (kısık, gecikmeli) sistem
// kanalından farklı tanınabilir ("başlı" ↔ "uçlu") ya da kaydın başında/sonunda sistem kanalında karşılığı kalmaz;
// aynı segmentteki diğer kelimelerin çoğu yankıysa bu kelimeler de yankıdır. Eşik: en az `minEchoes` yankı kelimesi ve
// segmentin en az `minRatio`'su. Kullanıcının gerçek sözü, karşı tarafın sözleriyle aynı segmentte büyük oranda
// örtüşmedikçe korunur (kısa segmentler ve az sayıda eşleşme etkilenmez).
export function expandEchoesBySegment(
  segments: { wordIds: string[] }[],
  echoes: Set<string>,
  { minEchoes, minRatio }: { minEchoes: number; minRatio: number }
): Set<string> {
  const expanded = new Set(echoes)
  for (const { wordIds } of segments) {
    const count = wordIds.filter((id) => echoes.has(id)).length
    if (count >= minEchoes && count / wordIds.length >= minRatio) {
      for (const id of wordIds) expanded.add(id)
    }
  }
  return expanded
}
