Status: ready-for-agent
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
