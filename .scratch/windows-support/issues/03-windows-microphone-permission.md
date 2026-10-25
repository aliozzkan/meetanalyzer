Status: ready-for-agent

# Windows mikrofon izni ve Ayarlar linki

Spec: [../spec.md](../spec.md) → "Mikrofon izni" (kullanıcı akışı ve teknik tasarım)

## Yapılacaklar

- `requestMicrophoneAccess`: Windows'ta `systemPreferences.getMediaAccessStatus('microphone')` okunur; `denied` → `'denied'`, diğerleri → `'granted'`. macOS davranışı değişmez. Linux'ta bugünkü gibi `'granted'`.
- Ayarlar linki platforma göre: macOS'ta bugünkü URL, Windows'ta `ms-settings:privacy-microphone`. `recordings/ipc.ts` platforma uygun olanı açar.
- Renderer'daki "izin yok" metninde macOS'a özgü ifade ("Sistem Ayarları") varsa Windows'ta "Ayarlar" olarak gösterilir.
- Platform kararı test edilebilir olsun diye platform ve Electron API'si parametre olarak geçilebilir.

## Kabul kriterleri

- [ ] Windows'ta mikrofon gizlilik anahtarı kapalıyken "Kaydı başlat" Recording oluşturmaz ve "izin yok" arayüzü görünür.
- [ ] "Ayarları aç" Windows'ta mikrofon gizlilik sayfasını açar.
- [ ] Anahtar açıldıktan sonra Recording uygulama yeniden başlatılmadan başlar.
- [ ] Platforma göre izin kararı ve link seçimi için birim testi var.
