// Main, preload ve renderer'ın ortak kullandığı Transcription modeli tipleri.

import type { IpcResult } from './ipc-result'

export type ModelErrorCode =
  | 'insufficient-space'
  | 'http-error'
  | 'network'
  | 'hash-mismatch'
  | 'unexpected-size'
  | 'internal-error'

// missing: kurulu değil (varsa yarım indirmenin bayt sayısıyla); downloading: sürüyor;
// ready: kurulu ve doğrulanmış; error: son deneme başarısız (yeniden denenebilir, yarım dosya korunur).
export type ModelState =
  | { status: 'missing'; partialBytes: number }
  | { status: 'downloading'; receivedBytes: number; totalBytes: number }
  | { status: 'ready' }
  | { status: 'error'; code: ModelErrorCode; message: string; partialBytes: number }

// Silme, indirme sürerken ya da Transcription Queue'da işlenen/bekleyen Meeting varken reddedilir.
export type ModelRemoveErrorCode = 'download-in-progress' | 'in-use' | 'internal-error'

export type ModelResult<T> = IpcResult<T, ModelRemoveErrorCode>

/** Silmenin neden reddedildiği; main hata mesajında, renderer devre dışı butonun tooltip'inde gösterir. */
export const MODEL_REMOVE_BLOCKED: Record<
  Exclude<ModelRemoveErrorCode, 'internal-error'>,
  string
> = {
  'download-in-progress': 'İndirme sürerken model silinemez.',
  'in-use': 'Metne dökme sürerken ya da sırada Meeting varken model silinemez.'
}
