export interface HistoryAvailability {
  canGoBack: boolean
  canGoForward: boolean
}

// Header'daki geri/ileri oklarının açık olup olmadığı. react-router'ın hash history'si her girişin sırasını
// `window.history.state.idx`'e yazar; `length` uygulamanın toplam geçmiş girişi sayısıdır (ileri girişler dahil).
export function historyAvailability(state: unknown, length: number): HistoryAvailability {
  const idx = (state as { idx?: unknown } | null)?.idx
  if (typeof idx !== 'number') return { canGoBack: false, canGoForward: false }
  return { canGoBack: idx > 0, canGoForward: idx < length - 1 }
}
