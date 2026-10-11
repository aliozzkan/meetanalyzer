import type { Language } from '../../shared/meeting'
import { WHISPER_MIN_THREADS, WHISPER_VAD_SAMPLES_OVERLAP_S } from '../config'

export interface WhisperArgsInput {
  modelPath: string
  wavPath: string
  /** Meeting'in Language'ı; otomatik dil algılama kullanılmaz (kısa ya da sessiz başlangıçlarda yanlış dil seçebilir). */
  language: Language
  vadModelPath: string
  /** whisper `<önek>.json` dosyasını yazar. */
  outputPrefix: string
  threads: number
}

// -ojf: token olasılıkları ve zamanlarıyla tam JSON; -pp: ilerleme yüzdesi (stderr)
export function buildWhisperArgs(input: WhisperArgsInput): string[] {
  return [
    '-m',
    input.modelPath,
    '-f',
    input.wavPath,
    '-l',
    input.language,
    '--vad',
    '--vad-model',
    input.vadModelPath,
    // Açıkça verilir: parser'ın VAD zaman eşlemesi (ADR-0006) bu değere dayanır.
    '--vad-samples-overlap',
    String(WHISPER_VAD_SAMPLES_OVERLAP_S),
    '-ojf',
    '-of',
    input.outputPrefix,
    '-t',
    String(input.threads),
    '-pp'
  ]
}

// docs/tuning.md → whisper thread sayısı: performans çekirdeklerinin yarısı, en az 2. Eşzamanlı Recording ve
// toplantı uygulamasına yer bırakmak için; çalışan bir process'in thread sayısı sonradan değiştirilemez.
export function whisperThreads(performanceCores: number): number {
  return Math.max(WHISPER_MIN_THREADS, Math.floor(performanceCores / 2))
}
