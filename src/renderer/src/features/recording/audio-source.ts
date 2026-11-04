// Bir Recording kanalının ses kaynağı (mikrofon, sistem sesi). Kaydın geri kalanı (IPC, WAV, kurtarma,
// transcription) kaynağın ne olduğunu bilmez; ileride yeni bir platform yalnızca yeni bir adapter'dır.
// Terimler: GLOSSARY.md (Recording), docs/meeting-lifecycle.md

import type { AudioChannel } from '@shared/audio'

/** Kaynak, kullanıcının izni olmadığı için açılamadı (mikrofon reddedildi, sistem sesi izni yok). */
export class AudioPermissionError extends Error {
  constructor(readonly channel: AudioChannel) {
    super(
      channel === 'system' ? 'Sistem sesi kaydı için izin verilmedi.' : 'Mikrofon izni verilmedi.'
    )
    this.name = 'AudioPermissionError'
  }
}

export interface AudioSourceHandlers {
  /** PCM_CHUNK_MS'lik, her zaman AUDIO_FORMAT (16 kHz mono 16-bit little-endian) PCM parçası. */
  onChunk: (pcm: Uint8Array) => void
  /** Her ses bloğu için tepe seviyesi (0..1) ve bloğun süresi. */
  onLevel: (peak: number, durationMs: number) => void
  /**
   * Kaynak beklenmedik şekilde kesildi (cihaz çıkarıldı, izin geri alındı…). `stop()` çağrıldıktan sonra
   * ve `start()` hata verdiyse çağrılmaz; açılışta kopma `start()`'ın hatasıdır.
   */
  onEnded: () => void
  /**
   * Kaynak kesilmeden başka bir cihaza geçti (ör. mikrofon çıkarıldı, varsayılana geçildi). Sessizlik gibi
   * cihaza bağlı sayaçlar sıfırlanır; Recording sürer.
   */
  onSwitched?: () => void
}

export interface AudioSource {
  /** Kaynağı açar ve parçaları üretmeye başlar. Açılamazsa (izin, cihaz yok, zaman aşımı) hata verir. */
  start: (handlers: AudioSourceHandlers) => Promise<void>
  /** Yakalamayı durdurur; kalan sesi son bir parça olarak `onChunk`'a verdikten sonra çözülür. */
  stop: () => Promise<void>
}
