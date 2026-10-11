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
