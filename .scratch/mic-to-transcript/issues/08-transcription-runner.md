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
