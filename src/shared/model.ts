// Main, preload ve renderer'ın ortak kullandığı Transcription modeli tipleri.

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
