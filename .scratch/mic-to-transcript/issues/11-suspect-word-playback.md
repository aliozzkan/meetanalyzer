Status: resolved
Blocked by: 10

# Suspect Word çevresindeki sesi çalma

Spec: [../spec.md](../spec.md) → "5. Correction"

## Yapılacaklar

- Suspect Word'e tıklanınca kelimenin `start_ms`/`end_ms` değerine göre config'teki pencere kadar (varsayılan ±2 sn, Recording sınırlarına kırpılır) ilgili `mic.wav` bölümü çalınır.
- Ses dosyası renderer'a güvenli şekilde sunulur (ör. özel protokol `protocol.handle` ile yalnızca `recordings/` altı, Range desteğiyle); renderer'a ham dosya yolu açılmaz.
- Popover'da tekrar çal düğmesi.

## Kabul kriterleri

- [ ] Tıklanan kelime çalınan pencerenin içinde duyulur.
- [ ] Özel protokol `recordings/` dışındaki yolları reddeder (test).

## Comments

**2026-10-11 (issue 03'ten):** `recording_channels.file_path` `recordingsDir`'e göreli saklanır; özel protokol bunu `recordingsDir` ile birleştirip sonucun `recordingsDir` içinde kaldığını doğrulamalı.

**2026-10-11 (issue 08'den):** `words.start_ms/end_ms` orijinal zaman çizgisindedir (VAD eşlemesi uygulanmış, ADR-0006). Bazı kelimeler sıfır uzunluklu gelebilir (`start_ms == end_ms`); ±2 sn pencereyle oynatırken sorun değil.

**2026-10-12 (implementasyon notu):** Özel protokol yerine IPC ile PCM dilimi kullanıldı: `transcript:word-audio` yalnızca kelime kimliği alır, yolu DB'den türetip `resolveRecordingFile` ile doğrular, `mic.wav`'dan pencere kadar PCM okuyup döner; renderer `AudioContext` ile çalar. Ham dosya yolu renderer'a açılmaz, CSP'ye `blob:`/`media-src` eklenmez, Range desteği gerekmez (dilim ~130 KB). "recordings/ dışı yollar reddedilir" testi `word-audio.test.ts`'te. **Elle doğrulanmadı:** "tıklanan kelime çalınan pencerenin içinde duyulur" kriteri gerçek uygulamada dinlenerek denenmeli.
