Status: ready-for-human
Type: prototype
Blocked by: system-audio/01, system-audio/02

# Windows sistem sesi prototipi

Spec: [../spec.md](../spec.md) → "Sistem sesi (Windows)", "Doğrulanmamış varsayımlar"; [sistem sesi spec'i](../../system-audio/spec.md) → "Ses kaynakları (adapter)"

Gerçek cihaz, paketlenmiş uygulama ve dinleyerek doğrulama gerektirdiği için insan işi. Sistem sesi issue 01'in Windows karşılığıdır; prototip kodu atılabilir.

## Yapılacaklar

- Atılabilir prototip: main'de `setDisplayMediaRequestHandler` → `audio: 'loopback'`, renderer'da `getDisplayMedia` ile akışı aç, 16 kHz mono'ya indirip `system.wav` olarak yaz. `build:unpack` ile paketlenmiş uygulamada dene.

## Ölçülecekler (sonuçlar spec'in "Doğrulanmamış varsayımlar" bölümüne yazılır)

- Video istemeden yalnızca ses alınabiliyor mu; olmuyorsa video track'i hemen durdurmak yetiyor mu.
- Windows bir izin sorusu gösteriyor mu.
- `restrictOwnAudio` Windows'ta var mı; Suspect Word dinletmesi (`AudioContext` çalması) kayda giriyor mu.
- Kayıt sürerken kulaklık takma, Bluetooth'a geçiş ve varsayılan çıkış değişimi: `ended` mı, yeni cihazı takip mi, sessizlik mi.
- Toplantı uygulamasının çıkışı varsayılan olmayan cihazdayken sistem kanalı sessiz mi.
- Kulaklıklı ve kulaklıksız birer gerçek toplantı kaydı (mic + system); yankı tekilleştirmesinin (ADR-0007) Windows'ta da benzer çalıştığını görmek için.

## Kabul kriterleri

- [ ] Prototip paketlenmiş uygulamada sistem sesini 16 kHz mono WAV olarak yazar.
- [ ] Her ölçümün sonucu spec'e yazılmıştır. `restrictOwnAudio` çalışmıyorsa issue 08'de yedek plan (Recording sürerken Suspect Word dinletmesinin kapatılması) kesinleşmiştir.
