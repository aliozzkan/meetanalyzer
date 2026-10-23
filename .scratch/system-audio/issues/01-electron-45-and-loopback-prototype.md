Status: ready-for-human
Type: prototype

# Electron 45'e geçiş ve sistem sesi prototipi

Spec: [../spec.md](../spec.md) → "Electron 45", "Doğrulanmamış varsayımlar"

Gerçek cihaz, imzalı paket ve dinleyerek doğrulama gerektirdiği için insan işi. Prototip kodu atılabilir; Electron yükseltmesi kalıcıdır.

## Yapılacaklar

- `electron` 45'e ve uyumlu `electron-vite` / `@electron-toolkit/*` / `electron-builder` sürümlerine geç; `better-sqlite3` rebuild; typecheck, lint, testler ve kısa bir Transcription duman testi.
- `electron-builder.yml`: `mac.minimumSystemVersion: '14.2'`, `extendInfo`'ya `NSAudioCaptureUsageDescription`.
- Atılabilir prototip: main'de `setDisplayMediaRequestHandler` → `callback({ audio: 'loopback' })`, renderer'da `getDisplayMedia` ile akışı aç, 16 kHz mono'ya indirip `system.wav` olarak yaz. Paketlenmiş (`build:unpack`) uygulamada dene; terminalden çalıştırınca izin terminale verilir.

## Ölçülecekler (sonuçlar spec'in "Doğrulanmamış varsayımlar" bölümüne yazılır)

- Video istemeden yalnızca ses alınabiliyor mu; olmuyorsa video track'i hemen durdurmak yetiyor mu.
- İzin reddedilince ne dönüyor (`ended` track mi, hata mı).
- Hardened runtime altında ek entitlement gerekiyor mu.
- `restrictOwnAudio` 45'te var mı; Suspect Word dinletmesi (`AudioContext` çalması) kayda giriyor mu.
- Kayıt sürerken AirPods'a geçiş ve varsayılan çıkış değişimi: `ended` mı, sessizlik mi.
- Zoom çıkışı varsayılan olmayan cihazdayken sistem kanalı sessiz mi.
- İzin istemi tekrar ediyor mu (aylık yenileme).
- Kulaklıklı ve kulaklıksız birer gerçek toplantı kaydı (mic + system); `src/main/transcription/fixtures/` altına alınabilecek kısa parçalar issue 07'nin testleri için.

## Kabul kriterleri

- [ ] Uygulama Electron 45'te çalışır; mevcut testler ve Transcription duman testi geçer.
- [ ] Prototip paketlenmiş uygulamada sistem sesini 16 kHz mono WAV olarak yazar.
- [ ] Yukarıdaki her ölçümün sonucu spec'e yazılmıştır; tasarımı değiştiren sonuçlar ilgili issue'lara not düşülmüştür.
- [ ] Kulaklıklı ve kulaklıksız örnek kayıtlar issue 07 için hazırdır.
