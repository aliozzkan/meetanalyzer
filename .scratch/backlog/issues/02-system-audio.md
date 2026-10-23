Status: resolved

# Sistem sesini (toplantıdaki diğer katılımcılar) kaydet

İlk dilim yalnızca mikrofon kaydediyor. Recording şeması baştan çok kanallı kuruldu. macOS'te `session.setDisplayMediaRequestHandler` + `audio: 'loopback'` + `getDisplayMedia` ile sistem sesini ayrı kanal olarak al. Açık sorular: Screen Recording izni akışı, iki kanalın ayrı mı birleşik mi transcribe edileceği (ayrı transcribe 'ben / diğerleri' ayrımını bedavaya verir), katılımcı rızası ve KVKK.

## Comments

**2026-10-23:** Spec'e taşındı: [../../system-audio/spec.md](../../system-audio/spec.md). Açık soruların cevapları orada: izin "System Audio Recording" (macOS 14.2+, ekran kaydı değil); iki kanal ayrı kaydedilir ve ayrı transcribe edilir (Side: Self / Others); katılımcı rızası için bir kerelik bilgilendirme.
