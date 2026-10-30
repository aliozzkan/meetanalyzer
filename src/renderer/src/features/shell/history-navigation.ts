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

export type HistoryDirection = 'back' | 'forward'

/** Kısayolda bakılan tuş bilgisi (`KeyboardEvent`in kullanılan kısmı). */
export interface HistoryKey {
  key: string
  code: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}

// Geri/ileri kısayolu: macOS'ta ⌘[ / ⌘], diğer platformlarda (tarayıcı alışkanlığı) Alt+← / Alt+→.
// macOS'ta Türkçe Q klavyede '[' Option ile üretilir: karakter (key) ya da fiziksel tuş (code) eşleşmesi yeter.
export function historyShortcut(event: HistoryKey, mac: boolean): HistoryDirection | null {
  if (mac) {
    if (!event.metaKey || event.shiftKey) return null
    if (event.key === '[' || event.code === 'BracketLeft') return 'back'
    if (event.key === ']' || event.code === 'BracketRight') return 'forward'
    return null
  }
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null
  if (event.key === 'ArrowLeft') return 'back'
  if (event.key === 'ArrowRight') return 'forward'
  return null
}

// Header'daki ok düğmelerinin ipucunda gösterilen kısayol.
export function historyShortcutLabel(direction: HistoryDirection, mac: boolean): string {
  if (mac) return direction === 'back' ? '⌘[' : '⌘]'
  return direction === 'back' ? 'Alt+←' : 'Alt+→'
}
