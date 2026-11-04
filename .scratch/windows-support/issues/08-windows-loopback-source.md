Status: ready-for-agent
Blocked by: 07, system-audio/03

# `WindowsLoopbackSource`

Spec: [../spec.md](../spec.md) → "Sistem sesi (Windows)"; [sistem sesi spec'i](../../system-audio/spec.md) → "Ses kaynakları (adapter)", "1. Bilgilendirme ve izinler"

## Yapılacaklar

- Main: Windows'ta `setDisplayMediaRequestHandler` → `audio: 'loopback'` (issue 07 video gerektiriyorsa ona göre). İzin handler'ı yalnızca bu isteğe izin verir; kamera hâlâ reddedilir. macOS'taki handler'la ortak kısım tek yerde durur.
- Renderer: `WindowsLoopbackSource`, `MacLoopbackSource` ile aynı arayüz. 48 kHz stereo → 16 kHz mono dönüşümü iki kaynak arasında paylaşılır. Kayıt sırasında `ended` → `onEnded`.
- Recording sistem sesi kaynağını platforma göre seçer. Windows'ta "sistem sesi izni yok" akışı yoktur; bir kerelik bilgilendirme gösterilir.
- `restrictOwnAudio` Windows'ta çalışıyorsa kullanılır. Çalışmıyorsa (issue 07) Windows'ta Recording sürerken Suspect Word dinletmesi devre dışıdır ve düğme kaydın bitmesini beklemek gerektiğini söyler.
- Issue 07'nin çıkış cihazı değişimi sonucuna göre kopma davranışı sistem sesi spec'indeki kuralla aynı olur: Recording durur, neden gösterilir.

## Kabul kriterleri

- [ ] Windows'ta bir Recording `mic.wav` ve `system.wav` yazar; ikisi de 16 kHz mono ve aynı anda başlar.
- [ ] Recording sürerken Suspect Word dinletilirse o ses `system.wav`'a girmez; ya da Windows'ta dinletme Recording sürerken devre dışıdır.
- [ ] Recording sürerken sistem sesi akışı koparsa Recording durur ve kullanıcı nedenini görür.
- [ ] Mikrofonda konuşma varken sistem kanalı baştan sona sessizse Recording sonunda sistem sesi spec'indeki uyarı görünür (metin Windows'a uyarlanır: "Windows'un varsayılan çıkışı").
- [ ] Windows'ta sistem sesi izniyle ilgili hiçbir arayüz görünmez.
