Status: ready-for-agent
Blocked by: 01

# Transcription modeli indirme ve onboarding

Spec: [../spec.md](../spec.md) → "1. Onboarding ve model"

## Yapılacaklar

- `ggml-large-v3-turbo-q5_0.bin` için Hugging Face `ggerganov/whisper.cpp` reposunda sabit bir commit revision'ı seç; URL'yi `.../resolve/<revision>/ggml-large-v3-turbo-q5_0.bin` biçiminde kur. Dosyayı indirip SHA-256'sını hesapla; revision ve hash'i config'e ve `docs/tuning.md`'ye yaz.
- Main'de indirici: `userData/models/<file>.part`'a yazar, HTTP Range ile kaldığı yerden devam eder, bitince SHA-256 doğrular ve atomik olarak yeniden adlandırır. Uyuşmazlıkta `.part` silinir ve hata döner.
- Başlamadan önce config'teki boş alan kontrolü.
- İndirme hiçbir zaman kendiliğinden başlamaz; yalnızca kullanıcı onayıyla başlar. Kullanıcının başlattığı bir indirme, sonradan Recording başlarsa durmaz.
- UI: ilk açılışta onboarding ekranı ("Transcription modeli (~550 MB) indirilsin mi?"), ilerleme çubuğu, yeniden deneme. Atlanırsa ilk "Transcribe" basışında aynı soru.

## Kabul kriterleri

- [ ] İndirme yarıda kesilip uygulama yeniden açıldığında kaldığı yerden devam eder.
- [ ] Bozuk dosya (hash uyuşmazlığı) kabul edilmez.
- [ ] Yetersiz alanda indirme başlamaz ve kullanıcı uyarılır.
- [ ] Hash doğrulama ve Range devam mantığı için birim testleri var.
