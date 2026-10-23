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
