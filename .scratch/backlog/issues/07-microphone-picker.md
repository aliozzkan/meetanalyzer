Status: ready-for-agent

# Mikrofon cihazı seçici

İlk dilim sistemin varsayılan mikrofonunu kullanıyor. Kullanıcıya cihaz seçimi ve Recording sırasında cihaz değişimini ele al.

## Comments

**2026-11-04:** Triage edildi ve spec'e döküldü: [microphone-picker/spec.md](../../microphone-picker/spec.md). Kararlar: seçim Ayarlar + "Kaydı başlat" yanında kısa seçici; seçili cihaz bağlı değilse sistem varsayılanına düşüp bilgi verilir; Recording sırasında mikrofon koparsa Recording sürer ve varsayılan mikrofona geçilir (kopma süresi sessizlikle doldurulur); seviye ölçer yok. Uygulama issue'ları spec'in "Uygulama sırası" bölümünde.
