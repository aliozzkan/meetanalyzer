Status: ready-for-human
Blocked by: 10

# Suspect Word eşiğini ve VAD'ı gerçek kayıtlarla ayarla

Spec: [../spec.md](../spec.md), [docs/tuning.md](../../../docs/tuning.md)

## Yapılacaklar

- Birkaç gerçek Türkçe ve İngilizce toplantı kaydı topla (farklı mikrofon, sessizlik, özel isim yoğunluğu).
- Transcribe et; gerçekten yanlış olan kelimeleri elle işaretle.
- 0.5 eşiğinde precision/recall'a bak; gerekirse eşiği değiştir.
- Uzun sessizliklerde uydurma metin kalıyor mu, konuşma başları kırpılıyor mu kontrol et; VAD eşiğini ayarla.
- Sonuçları ve yeni değerleri `docs/tuning.md`'ye yaz.

## Kabul kriterleri

- [ ] `docs/tuning.md`'de eşik değerleri ölçüm notlarıyla güncellenmiş.

## Comments

**2026-10-11 (issue 03'ten):** `SILENT_MIC_PEAK_THRESHOLD = 0.0005` (≈ -66 dBFS) kalibre edilmedi. Gerçek mikrofonlarda açık-ama-sessiz oda ile donanım sessize alma arasındaki tepe seviyelerini ölç; yanlış alarm olmadan sessize almayı yakalayan eşiği seç ve `docs/tuning.md`'ye yaz. Ayrıca mikrofon ses işleme (otomatik kazanç kapalı) düşük seviyeli mikrofonlarda kaliteyi nasıl etkiliyor, karşılaştır.
