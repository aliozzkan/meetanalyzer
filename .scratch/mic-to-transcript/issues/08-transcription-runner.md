Status: ready-for-agent
Blocked by: 01, 06

# Tek bir Recording'i transcribe etme ve Suspect Word üretme

Spec: [../spec.md](../spec.md) → "Transcription", "Suspect Word (ADR-0002)"

## Yapılacaklar

- Runner: bir WAV + Language alır, `whisper-cli -m <model> -f <wav> -l <tr|en> --vad --vad-model <vad> -ojf -of <tmp> -t <threads>` çalıştırır. Thread sayısı ve öncelik config'ten; spawn'dan hemen sonra `os.setPriority(pid, …)`.
- İlerlemeyi stdout/stderr'den okuyup yüzde olarak yayınla. `cancel()` process'i öldürür.
- Parser: `-ojf` JSON'unu `segments` ve `words`'e dönüştürür. Token → kelime gruplama (boşlukla başlayan token yeni kelime; özel `[_...]` token'ları atılır; noktalama önceki kelimeye eklenir). Kelime güveni = token olasılıklarının minimumu; config eşiğinin altındaysa `is_suspect = 1`.
- Sonuçlar tek transaction'da yazılır ve `recordings.transcribed_at` set edilir; hata olursa hiçbir şey yazılmaz.

## Kabul kriterleri

- [ ] Gerçek bir whisper `-ojf` çıktısından alınmış Türkçe ve İngilizce fixture'larla parser testleri (ekler, noktalama, özel token'lar).
- [ ] Kısa bir test WAV'ı uçtan uca transcribe edilip DB'ye yazılır.
- [ ] `cancel()` sonrası DB'de yarım veri kalmaz.

## Comments

**2026-10-11 (issue 06 duman testinden):**
- Yol çözümü: `getWhisperPaths({ isPackaged, appPath, resourcesPath })` (`src/main/whisper/paths.ts`) `{ cli, vadModel }` döndürür. Binary ve VAD dosyası yoksa runner anlaşılır bir hata vermeli ("`pnpm build:whisper` çalıştır").
- `-ojf` çıktısı: `transcription[]` (segmentler: `timestamps`, `offsets` {from,to ms}, `text`, `tokens[]`). Her token: `text`, `p` (olasılık), `offsets`, `id`, `t_dtw`, `timestamps`. Özel token'lar köşeli parantezli (`[_BEG_]`, `[_TT_415]`); `[_TT_*]` zaman damgası token'ıdır ve düşük `p` taşıyabilir, kelimeye katılmamalı. Token metni boşlukla başlıyorsa yeni kelime başlar.
- **Metal ilk çalıştırma maliyeti:** gömülü Metal kütüphanesi ilk çalıştırmada derlenir (ölçüm: ~46 sn, 35 kütüphane), sonuç sistem önbelleğine yazılır ve sonraki başlatmalar ~0.3 sn. Yani kullanıcının makinesindeki ilk Transcription uzun süre ilerleme göstermeden bekleyebilir; UI'da "ilk kullanım hazırlığı" gibi bir durum gösterilmeli, süreç bu sürede hata sanılıp öldürülmemeli (timeout koyma). Önbellek temizlenirse ya da macOS güncellenirse tekrarlanabilir.
- Duman testi: `whisper-cli -m ggml-tiny.bin -f jfk.wav -l en --vad -vm resources/models/ggml-silero-v6.2.0.bin -ojf -of <çıktı> -t 4` çalıştı (exit 0, VAD zaman damgaları 0.32–10.47 sn).
