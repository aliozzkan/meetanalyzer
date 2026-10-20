import { TRANSCRIPTION_MODEL_INFO } from '../shared/model-info'

// Ayarlanabilir değerler. Her değerin gerekçesi ve nasıl yeniden ayarlanacağı
// docs/tuning.md içindedir; bir değeri değiştirirken o dokümanı da güncelle.

// Varsayılan Language (docs/tuning.md) renderer ile paylaşıldığı için src/shared/meeting.ts'te durur.

// Ses sabitleri (format, parça süresi, sessiz mikrofon uyarısı) renderer ile paylaşıldığı için
// src/shared/audio.ts'te durur.

// docs/tuning.md → Suspect Word eşiği (ADR-0002). Kelimenin güveni, harf/rakam içeren token
// olasılıklarının minimumudur (noktalama katılmaz); bu değerin altındaysa Suspect Word'dür.
export const SUSPECT_WORD_THRESHOLD = 0.5

// docs/tuning.md → whisper process önceliği (nice): yüksek değer düşük öncelik demektir; eşzamanlı Recording
// ve toplantı uygulaması takılmasın. Transcription çalıştırıcısına çağıran (issue 09) geçirir.
export const WHISPER_NICE = 10

// docs/tuning.md → whisper thread sayısı: performans çekirdeklerinin yarısı, en az bu kadar
// (bkz. src/main/transcription/whisper-args.ts).
export const WHISPER_MIN_THREADS = 2

// docs/tuning.md → VAD örtüşmesi (sn). whisper'a `--vad-samples-overlap` ile açıkça verilir ve parser'ın
// VAD zaman eşlemesi (ADR-0006) aynı değeri kullanır; whisper varsayılanına güvenilmez. VAD'in kendisi
// (--vad) ADR-0002 gereği her zaman açıktır.
export const WHISPER_VAD_SAMPLES_OVERLAP_S = 0.1

// docs/tuning.md → VAD modeli. Dosya adı scripts/build-whisper.sh içindeki VAD_MODEL_FILE ile
// aynı olmalıdır; birini değiştirirken diğerini de güncelle.
export const WHISPER_VAD_MODEL_FILE = 'ggml-silero-v6.2.0.bin'

// docs/tuning.md → whisper.cpp sürümü. Hakkında ekranında gösterilir; scripts/build-whisper.sh içindeki
// WHISPER_CPP_TAG ile aynı olmalıdır (src/main/whisper/version.test.ts denetler).
export const WHISPER_CPP_VERSION = 'v1.9.5'

// docs/tuning.md → Transcription modeli, Model kaynağı, Model SHA-256. Revision ve hash birlikte güncellenir.
export const TRANSCRIPTION_MODEL = {
  ...TRANSCRIPTION_MODEL_INFO,
  // Hugging Face repo commit'i (main, 2024-10-29): dosya habersizce değişemez.
  revision: '5359861c739e955e79d9a303bcbc70fb988958b1',
  sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2'
} as const

export const TRANSCRIPTION_MODEL_URL = `https://huggingface.co/${TRANSCRIPTION_MODEL.repo}/resolve/${TRANSCRIPTION_MODEL.revision}/${TRANSCRIPTION_MODEL.fileName}`

// docs/tuning.md → İlerleme sıklığı: model indirme ve Transcription ilerlemesi arayüze en fazla bu aralıkla iletilir.
export const PROGRESS_BROADCAST_INTERVAL_MS = 250

// docs/tuning.md → Model indirme öncesi boş alan
export const MODEL_DOWNLOAD_MIN_FREE_BYTES = 1024 ** 3

// docs/tuning.md → Suspect Word dinleme penceresi (kelimenin öncesi ve sonrası)
export const SUSPECT_WORD_PLAYBACK_PADDING_MS = 2_000
