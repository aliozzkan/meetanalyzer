// Main ve renderer'ın paylaştığı ses sabitleri. Gerekçeler ve nasıl yeniden ayarlanacakları
// docs/tuning.md içindedir; bir değeri değiştirirken o dokümanı da güncelle.

// docs/tuning.md → Ses formatı (ADR-0003)
export const AUDIO_FORMAT = {
  sampleRate: 16_000,
  channels: 1,
  bitsPerSample: 16
} as const

// AUDIO_FORMAT'tan türetilenler: bir örnek çerçevesinin bayt sayısı ve bir saniyelik sesin bayt sayısı.
export const BLOCK_ALIGN = (AUDIO_FORMAT.channels * AUDIO_FORMAT.bitsPerSample) / 8
export const BYTES_PER_SECOND = AUDIO_FORMAT.sampleRate * BLOCK_ALIGN

export function durationMsFromBytes(audioBytes: number): number {
  return Math.round((audioBytes / BYTES_PER_SECOND) * 1000)
}

// docs/tuning.md → PCM parça süresi
export const PCM_CHUNK_MS = 5_000

// docs/tuning.md → Sessiz mikrofon uyarısı
export const SILENT_MIC_WARNING_MS = 10_000

// docs/tuning.md → Sessiz mikrofon uyarısı (tepe seviyesi eşiği; kalibrasyon bekliyor)
export const SILENT_MIC_PEAK_THRESHOLD = 0.0005
