import { MODEL_NOTHING_TO_REMOVE, MODEL_REMOVE_BLOCKED, type ModelState } from '@shared/model'
import { hasPendingTranscription, type TranscriptionStatus } from '@shared/transcription'

// Transcription modelinin durumundan türeyen, arayüzün birden çok yerinde (ModelCard, header göstergesi,
// Ayarlar > Transcription Modeli) aynı görünmesi gereken değerler.

/** İndirme yüzdesi (0–100, tam sayı). Alınan bayt toplamı geçse de 100'de durur. */
export function downloadPercent(receivedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0
  return Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
}

// Ondalık MB (Finder ve Hugging Face'in gösterdiği gibi): 574 041 195 bayt = 574 MB.
export function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1e6)} MB`
}

/** Header'daki model göstergesinin görünümü. */
export type ModelIndicator =
  { kind: 'missing' } | { kind: 'downloading'; percent: number } | { kind: 'error' }

/** Model hazırsa (ya da durum henüz okunmadıysa) gösterge hiç yer kaplamaz: null. */
export function modelIndicatorState(state: ModelState | null): ModelIndicator | null {
  switch (state?.status) {
    case 'missing':
      return { kind: 'missing' }
    case 'downloading':
      return {
        kind: 'downloading',
        percent: downloadPercent(state.receivedBytes, state.totalBytes)
      }
    case 'error':
      return { kind: 'error' }
    default:
      return null
  }
}

/** Ayarlar > Transcription Modeli'nde modelin adının yanındaki durum metni. */
export function modelStatusLabel(state: ModelState): string {
  switch (state.status) {
    case 'ready':
      return 'Hazır'
    case 'missing':
      return state.partialBytes > 0
        ? `Yarım kaldı (${megabytes(state.partialBytes)})`
        : 'İndirilmedi'
    case 'downloading':
      return state.receivedBytes >= state.totalBytes
        ? 'Doğrulanıyor…'
        : `İndiriliyor · %${downloadPercent(state.receivedBytes, state.totalBytes)}`
    case 'error':
      return 'İndirme başarısız'
  }
}

/** Silme butonu devre dışıysa nedeni (tooltip), değilse null. Main aynı kuralı ayrıca uygular. */
export function removeBlockReason(
  state: ModelState,
  transcription: TranscriptionStatus
): string | null {
  if (state.status === 'downloading') return MODEL_REMOVE_BLOCKED['download-in-progress']
  if (hasPendingTranscription(transcription)) return MODEL_REMOVE_BLOCKED['in-use']
  if (state.status === 'missing' && state.partialBytes === 0) return MODEL_NOTHING_TO_REMOVE
  return null
}
