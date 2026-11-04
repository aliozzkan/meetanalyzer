Status: ready-for-agent
Blocked by: 03

# İki kanallı Recording ve kurtarma

Spec: [../spec.md](../spec.md) → "2. Recording", "Veri", "Çökme sonrası toparlanma"

## Yapılacaklar

- Migration: `recording_channels.kind` `'mic' | 'system'`; kanal başına `transcribed_at` (mevcut `recordings.transcribed_at` değerleri `mic` kanalına taşınır).
- `recording-service`: Recording başlarken iki kanal satırı ve iki dosya (`mic.wav`, `system.wav`); `recordings:append` kanal adıyla. İki kaynaktan biri açılamazsa Recording başlamaz ve boş Recording silinir (`discard`).
- Kayıt sırasında bir kaynak `onEnded` verirse Recording durur (`stop`), iki dosya da kapanır; sebep renderer'a iletilir (arayüz issue 05'te).
- Kurtarma (`recovery.ts`): kanallar Recording bazında gruplanır; her dosya ayrı onarılır; `ended_at` kısa kanala göre; kanallardan biri boşsa Recording bütün olarak silinir. `docs/meeting-lifecycle.md` "Çökme" maddesi güncellenir.
- Onay (`approval-service`): iki kanalın dosyası da silinir (mevcut sorgu kanal bağımsızsa testle doğrulanır).
- Meeting silme: iki dosya da kalkar.

## Kabul kriterleri

- [ ] Bir Recording `mic.wav` ve `system.wav` yazar, ikisi aynı anda başlar.
- [ ] Bir kaynak açılamazsa Recording oluşmaz.
- [ ] Kayıt sırasında bir kaynak koparsa Recording durur, kaydedilen kısım korunur.
- [ ] Zorla kapatma sonrası iki dosya da onarılır; kanallardan biri boşsa Recording silinir (test).
- [ ] Onay ve Meeting silme iki dosyayı da kaldırır (test).
- [ ] Migration mevcut tek kanallı Recording'leri bozmaz (test).

## Uygulama notu

Kod tamamlandı, testler henüz çalıştırılmadı ([test-checklist.md](../test-checklist.md)). Kabul kriterleri testten sonra işaretlenecek.

- Migration 5 `recording_channels`'ı yeniden kurar (`kind IN ('mic','system')`, `transcribed_at`); eski `recordings.transcribed_at` "tüm kanallar bitti" anlamında kalır ve mevcut değer `mic` kanalına kopyalanır.
- `recording-service`: `start` iki dosya (`mic.wav`, `system.wav`) ve iki kanal satırı yazar; `append(id, pcm, channel = 'mic')` kanalı doğrular; `stop` her iki header'ı ayrı dener ve kanal sürelerini yazar (özet süre = uzun kanal); `discard` klasörü komple siler.
- Kayıt sırasında kopma main'de ayrı kod gerektirmedi: renderer controller (`onEnded` → `finish`) normal `stop`'u çağırır, kaydedilen kısım korunur; sebep `interrupted` ile arayüze iletilir (issue 05).
- `recovery.ts`: Recording bazında gruplanır, her dosya ayrı onarılır, `ended_at` = başlangıç + en kısa kanal süresi; kanallardan biri boşsa/yoksa Recording bütün olarak silinir.
- Onay (`purgeApprovedAudio`) ve Meeting silme zaten klasör bazlıdır; iki dosya için test eklendi.
- `use-recorder` artık `mic` + `system` kaynaklarını bağlar (consent kapısı issue 05'te eklenene kadar `Kaydı başlat` her iki izni ister).
