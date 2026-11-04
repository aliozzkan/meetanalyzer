Status: ready-for-agent
Blocked by: 01

# `AudioSource` adapter'ı

Spec: [../spec.md](../spec.md) → "Ses kaynakları (adapter)"

Davranış değişikliği yok: mikrofon kaydı bugünkü gibi çalışır, ama kaynak bir arayüzün arkasındadır ve kaydın geri kalanı kaynağın ne olduğunu bilmez.

## Yapılacaklar

- Renderer'da `AudioSource` arayüzü: `start`, `stop` (kalanı flush ederek), `onChunk` (her zaman `AUDIO_FORMAT`), `onLevel`, `onEnded` (kaynak beklenmedik şekilde kesildi).
- `mic-capture.ts` → `MicSource`; track'in `ended` olayı `onEnded`'a bağlanır.
- `recorder-controller` / `use-recorder` kaynağı arayüz üzerinden kullanır; birden çok kaynağı aynı Recording'e bağlayabilecek biçimde (kanal adıyla) kurulur ama bu issue'da tek kaynak (`mic`) bağlanır.
- Issue 01'in sonuçları arayüzü değiştiriyorsa (ör. açılışta izin kontrolü için ayrı bir adım) burada yansıtılır.

## Kabul kriterleri

- [ ] Mikrofon kaydı, seviye göstergesi, sessiz mikrofon uyarısı ve durdurma bugünkü gibi çalışır.
- [ ] `recorder-controller` testleri sahte bir `AudioSource` ile çalışır; `onEnded` senaryosu test edilir.
- [ ] Kaydın IPC, WAV ve kurtarma tarafında kaynak türüne özel kod yoktur.

## Uygulama notu

Kod tamamlandı, testler henüz çalıştırılmadı ([test-checklist.md](../test-checklist.md)). Kabul kriterleri testten sonra işaretlenecek.

- `AudioSource { start(handlers), stop() }` + `AudioSourceHandlers { onChunk, onLevel, onEnded }`. Ortak PCM hattı `pcm-pipeline.ts`'e çıkarıldı (sistem sesi aynısını kullanacak); `mic-capture.ts` → `mic-source.ts`.
- `recorder-controller` birden çok kaynağı kanal adıyla yönetir (`createSources`). Tüm kaynaklar açılana kadar gelen parçalar atılır (kanallar aynı anda başlasın); açılışta biri başarısız olursa açılanlar kapatılır ve boş Recording silinir.
- `onEnded` → Recording kendiliğinden biter, snapshot'ta `interrupted: { meetingId, channel }` kalır (arayüzü issue 05).
- Main tarafı (IPC, WAV, kurtarma) hâlâ yalnızca `mic` yazıyor; kanal desteği issue 04'te. Preload `append` artık `channel` alır, main şimdilik yok sayar.
