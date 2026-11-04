Status: ready-for-agent
Blocked by: 04

# Recording arayüzü: bilgilendirme, iki gösterge, kopma ve sessiz toplantı uyarıları

Spec: [../spec.md](../spec.md) → "1. Bilgilendirme ve izinler", "2. Recording"

## Yapılacaklar

- İlk "Kaydı başlat"tan önce bir kerelik bilgilendirme (metin spec'te); kabul ayarlarda saklanır, kabul edilmeden Recording başlamaz.
- İki seviye göstergesi: "Sen" ve "Toplantı" (Recording pill'i ve Meeting detayı). Sessiz mikrofon uyarısı yalnızca "Sen" için.
- Kopma: "Sistem sesi kesildi" / "Mikrofon kesildi" bildirimi ve tek tıkla yeni Recording başlatan düğme.
- Recording bitince: mikrofonda konuşma olduğu halde sistem kanalı baştan sona sessizse "Toplantı sesi duyulmadı…" uyarısı. Eşikler `docs/tuning.md`'ye yeni satır olarak eklenir (sessiz mikrofon eşiğiyle aynı tepe eşiği başlangıç değeri olabilir).

## Kabul kriterleri

- [ ] Bilgilendirme kabul edilmeden Recording başlamaz; kabulden sonra bir daha sorulmaz.
- [ ] İki gösterge ayrı ayrı hareket eder.
- [ ] Kayıt sırasında çıkış cihazı değişince ya da izin geri alınınca kullanıcı nedeni görür ve tek tıkla yeni Recording başlatabilir.
- [ ] Sistem kanalı baştan sona sessiz bir Recording'den sonra uyarı görünür; diğer katılımcıların konuştuğu Recording'de görünmez.
- [ ] Sessiz toplantı kararı için birim testi var.

## Uygulama notu

Kod tamamlandı, testler henüz çalıştırılmadı ([test-checklist.md](../test-checklist.md)). Kabul kriterleri testten sonra işaretlenecek.

- Bilgilendirme: kabul `settings` tablosunda (`system_audio_consent`); **kapı main'dedir** (`recording-service.start` → `system-audio-consent-required`), arayüz yalnızca uyarıyı gösterir ve "Anladım, kaydı başlat" ile kabul edip aynı tıklamayla başlatır. Metin spec'teki üç maddeyi (diğer katılımcılar, sorumluluk, ses yalnızca cihazda) içerir.
- İki gösterge Meeting detayında ("Sen", "Toplantı"); header'daki kayıt pill'i yalnızca süre gösteriyordu, seviye eklenmedi.
- Kopma: `interrupted` ile "Sistem sesi kesildi" / "Mikrofon kesildi" uyarısı ve "Yeni Recording başlat" düğmesi.
- Sessiz toplantı: karar `shared/meeting-silence.ts` (saf, testli); eşikler `docs/tuning.md`'de yeni satır. Kopmayla biten Recording için verilmez.
