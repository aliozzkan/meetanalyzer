Status: resolved

# Windows mikrofon izni ve Ayarlar linki

Spec: [../spec.md](../spec.md) → "Mikrofon izni" (kullanıcı akışı ve teknik tasarım)

## Yapılacaklar

- `requestMicrophoneAccess`: Windows'ta `systemPreferences.getMediaAccessStatus('microphone')` okunur; `denied` → `'denied'`, diğerleri → `'granted'`. macOS davranışı değişmez. Linux'ta bugünkü gibi `'granted'`.
- Ayarlar linki platforma göre: macOS'ta bugünkü URL, Windows'ta `ms-settings:privacy-microphone`. `recordings/ipc.ts` platforma uygun olanı açar.
- Renderer'daki "izin yok" metninde macOS'a özgü ifade ("Sistem Ayarları") varsa Windows'ta "Ayarlar" olarak gösterilir.
- Platform kararı test edilebilir olsun diye platform ve Electron API'si parametre olarak geçilebilir.

## Kabul kriterleri

- [x] Windows'ta mikrofon gizlilik anahtarı kapalıyken "Kaydı başlat" Recording oluşturmaz ve "izin yok" arayüzü görünür.
- [x] "Ayarları aç" Windows'ta mikrofon gizlilik sayfasını açar.
- [x] Anahtar açıldıktan sonra Recording uygulama yeniden başlatılmadan başlar.
- [x] Platforma göre izin kararı ve link seçimi için birim testi var.

## Comments

**2026-10-25:** Uygulandı.

- `microphone.ts`: `checkMicrophoneAccess(platform, api)` macOS davranışını korur; Windows'ta yalnızca `getMediaAccessStatus` `denied` dönerse `denied` verir, soru göstermez. `microphoneSettingsUrl(platform)`: macOS'ta Sistem Ayarları, Windows'ta `ms-settings:privacy-microphone`, diğerlerinde `null` (IPC bir şey açmaz). Testleri `microphone.test.ts`.
- Renderer: `lib/platform.ts` → `PLATFORM`; `microphone-permission.ts` uyarı metnini ve düğme adını platforma göre verir (Windows: "Ayarlar'ı aç" ve masaüstü uygulamaları anahtarı); düğme yoksa gösterilmez. Testleri `microphone-permission.test.ts`.
- Kullanıcı Windows 11'de doğruladı: masaüstü uygulamaları anahtarı kapalıyken uyarı Windows metniyle çıktı, "Ayarlar'ı aç" mikrofon gizlilik sayfasını açtı, anahtar açılınca "Tekrar dene" yeniden başlatmadan kaydı başlattı.
- Uyarıyı main'deki ön kontrolün mü, renderer'daki `getUserMedia` yedeğinin mi gösterdiği ayrıca ölçülmedi; ikisi de aynı arayüzü gösterir ve boş Recording bırakmaz.
