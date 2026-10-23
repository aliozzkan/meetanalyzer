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
