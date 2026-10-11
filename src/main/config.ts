// Ayarlanabilir değerler. Her değerin gerekçesi ve nasıl yeniden ayarlanacağı
// docs/tuning.md içindedir; bir değeri değiştirirken o dokümanı da güncelle.

// Varsayılan Language (docs/tuning.md) renderer ile paylaşıldığı için src/shared/meeting.ts'te durur.

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

// docs/tuning.md → Suspect Word eşiği (ADR-0002). Kelimenin güveni,
// token olasılıklarının minimumudur; bu değerin altındaysa Suspect Word'dür.
export const SUSPECT_WORD_THRESHOLD = 0.5

// docs/tuning.md → whisper process önceliği. Thread sayısı (performans
// çekirdeklerinin yarısı) issue 08'de, runner ile birlikte hesaplanır.
export const WHISPER_NICE = 10

// docs/tuning.md → VAD
export const WHISPER_VAD_ENABLED = true

// docs/tuning.md → VAD modeli. Dosya adı scripts/build-whisper.sh içindeki VAD_MODEL_FILE ile
// aynı olmalıdır; birini değiştirirken diğerini de güncelle.
export const WHISPER_VAD_MODEL_FILE = 'ggml-silero-v6.2.0.bin'

// docs/tuning.md → Transcription modeli, Model kaynağı, Model SHA-256.
// TODO(issue 07): revision ve sha256 ilk indirmede sabitlenecek.
export const TRANSCRIPTION_MODEL = {
  fileName: 'ggml-large-v3-turbo-q5_0.bin',
  repo: 'ggerganov/whisper.cpp',
  revision: 'TODO',
  sha256: 'TODO'
} as const

// docs/tuning.md → Model indirme öncesi boş alan
export const MODEL_DOWNLOAD_MIN_FREE_BYTES = 1024 ** 3

// docs/tuning.md → Suspect Word dinleme penceresi (kelimenin öncesi ve sonrası)
export const SUSPECT_WORD_PLAYBACK_PADDING_MS = 2_000
