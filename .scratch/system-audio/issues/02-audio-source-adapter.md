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
