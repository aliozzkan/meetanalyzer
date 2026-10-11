export type TranscriptionErrorCode =
  | 'invalid-output' // whisper çıktısı beklenen biçimde değil
  | 'whisper-missing' // binary ya da VAD modeli yok
  | 'whisper-failed' // whisper sıfırdan farklı kodla çıktı
  | 'cancelled'
  | 'recording-not-found' // Recording yok ya da silinmiş
  | 'audio-missing' // ses dosyası yok (ör. onaydan sonra silinmiş)
  | 'already-transcribed'
  | 'recording-not-finished' // Recording henüz bitmemiş (kayıt sürüyor ya da kurtarılmamış)

export class TranscriptionError extends Error {
  constructor(
    readonly code: TranscriptionErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'TranscriptionError'
  }
}
