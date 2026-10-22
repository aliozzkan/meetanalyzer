export interface HistoryAvailability {
  canGoBack: boolean
  canGoForward: boolean
}

/** Navigation API'nin (`window.navigation`) gösterdiği konum: toplam giriş ve şu anki girişin sırası. */
export interface NavigationPosition {
  entryCount: number
  currentIndex: number
}

// react-router'ın hash history'si her girişin sırasını `window.history.state.idx`'e yazar; henüz yazmadıysa null.
function routerIndex(historyState: unknown): number | null {
  const idx = (historyState as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx : null
}

// Header'daki geri/ileri oklarının açık olup olmadığı. `length` uygulamanın toplam geçmiş girişi sayısıdır
// (ileri girişler dahil; bkz. `appEntryCount`).
export function historyAvailability(historyState: unknown, length: number): HistoryAvailability {
  const idx = routerIndex(historyState)
  if (idx === null) return { canGoBack: false, canGoForward: false }
  return { canGoBack: idx > 0, canGoForward: idx < length - 1 }
}

// `history.length` uygulamadan önceki girişleri de sayar. Uygulamanın girişleri: router'ın sırası (`idx`) kadar
// geride, Navigation API'nin gösterdiği kadar ileride. İkisinden biri yoksa `history.length`'e düşülür.
export function appEntryCount(
  historyState: unknown,
  historyLength: number,
  navigation: NavigationPosition | null
): number {
  const idx = routerIndex(historyState)
  if (!navigation || idx === null) return historyLength
  const ahead = navigation.entryCount - 1 - navigation.currentIndex
  return idx + 1 + ahead
}
