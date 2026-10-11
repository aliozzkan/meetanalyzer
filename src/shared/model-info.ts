// Transcription modelinin main ve renderer'ın paylaştığı bilgileri.
// Revision ve hash gibi indirme ayrıntıları yalnızca main'dedir (src/main/config.ts).
export const TRANSCRIPTION_MODEL_INFO = {
  fileName: 'ggml-large-v3-turbo-q5_0.bin',
  repo: 'ggerganov/whisper.cpp',
  sizeBytes: 574_041_195
} as const
