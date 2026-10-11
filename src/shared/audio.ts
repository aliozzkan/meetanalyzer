// Main ve renderer'ın paylaştığı ses sabitleri. Gerekçeler ve nasıl yeniden ayarlanacakları
// docs/tuning.md içindedir; bir değeri değiştirirken o dokümanı da güncelle.

// docs/tuning.md → Ses formatı (ADR-0003)
export const AUDIO_FORMAT = {
  sampleRate: 16_000,
  channels: 1,
  bitsPerSample: 16
} as const

// docs/tuning.md → PCM parça süresi
export const PCM_CHUNK_MS = 5_000

// docs/tuning.md → Sessiz mikrofon uyarısı
export const SILENT_MIC_WARNING_MS = 10_000

// docs/tuning.md → Sessiz mikrofon uyarısı (tepe seviyesi eşiği; kalibrasyon bekliyor)
export const SILENT_MIC_PEAK_THRESHOLD = 0.0005
