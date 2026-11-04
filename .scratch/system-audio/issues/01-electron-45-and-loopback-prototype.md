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

## İlerleme

Yapıldı (agent):

- `electron` 39.8.10 → **45.0.0** (Node 24.22, ABI 150). Yalnızca `electron` yükseltildi; `electron-vite` 5, `@electron-toolkit/*`, `electron-builder` mevcut sürümlerinde sorunsuz çalışıyor. `better-sqlite3` `electron-builder install-app-deps` ile yeniden derlendi.
- `pnpm typecheck` temiz, `pnpm test` 288/288 geçti (Electron 45 altında).
- `electron-builder.yml`: `mac.minimumSystemVersion: '14.2'` ve `NSAudioCaptureUsageDescription` eklendi.
- Atılabilir prototip hazır: `prototypes/system-audio-loopback/` (uygulama koduna bağlı değil). Paketlenmiş `.app` hardened runtime ile mevcut `entitlements.mac.plist` kullanılarak imzalandı.

Kalan (insan): Transcription duman testi (model gerekir), aşağıdaki ölçümler, örnek kayıtlar.

### Prototipi çalıştırma

```bash
cd prototypes/system-audio-loopback
../../node_modules/.bin/electron-builder --mac --dir --config electron-builder.yml
open dist/mac-arm64/LoopbackPrototype.app          # izin uygulamaya verilir
# ya da: ../../node_modules/.bin/electron .        # izin terminale verilir
```

Pencerede: "video:true iste", "restrictOwnAudio", "loopbackWithMute" kutuları, Başlat/Durdur (`system.wav` `userData/prototype-out/` altına yazılır), 440 Hz test tonu düğmesi. Log penceresi `track.ended/mute/unmute`, `devicechange` ve saniyelik RMS'i gösterir.

### Ölçüm sonuçları

| Ölçüm | Sonuç |
|---|---|
| Yalnızca ses (video:false) alınabiliyor mu | **Evet.** `getDisplayMedia({ audio: true, video: false })` Electron 45.0.0 (Chrome 156) paketlenmiş uygulamada hatasız: `audioTracks = 1`, `videoTracks = 0`. Ekran kaydı izni gerekmedi (`screen: denied` iken çalıştı). Açılış ~2 sn (izin istemi dahil). |
| İzin reddi: ne dönüyor | **Hata yok, akış açılır.** `getDisplayMedia` başarıyla döner (`audioTracks = 1`), ama ses track'i `getDisplayMedia` döner dönmez `readyState: 'ended'` (log aynı ms'de). `ended` **olayı gelmez** (dinleyici bağlanmadan önce geçti); durum `readyState` ile okunmalı. `rms/sn` baştan sona 0, `peak = 0.0000`. `loopbackWithMute` modu da aynı. Mevcut `MacLoopbackSource` (300 ms sonra `readyState === 'ended'` → `AudioPermissionError`) bu davranışa uygun. |
| Hardened runtime ek entitlement | **Gerekmedi.** Paketlenmiş uygulama `flags=runtime` (hardened runtime) ve yalnızca mevcut `build/entitlements.mac.plist` (JIT, unsigned memory, dyld env, `audio-input`) ile imzalıydı; sistem sesi yakalama çalıştı. (Apple Development imzası; Developer ID + notarization ile ayrıca doğrulanmadı.) |
| `restrictOwnAudio` 45'te var mı / dinletme kayda giriyor mu | **Var ve çalışıyor.** `getSupportedConstraints().restrictOwnAudio === true`; `audio: { restrictOwnAudio: true }` ile track ayarı `restrictOwnAudio: true`, `deviceId: 'loopbackWithoutChrome'`. Uygulamanın `AudioContext` ile çaldığı 440 Hz ton 18 sn boyunca çalarken kaydın `peak`'i **0.0000**: kendi sesimiz (Suspect Word dinletmesi) kayda girmiyor. **Kontrol:** kısıt kapalıyken (`deviceId: 'loopback'`) aynı ton kayda giriyor: `rms/sn = 0.0707` (= 0,1 genlikli sinüsün RMS'i), `peak = 0.1000`. Dışlama `restrictOwnAudio`'dan geliyor. |
| AirPods'a geçiş / çıkış değişimi | **Akış kesilmez.** (a) AirPods varsayılan giriş+çıkışken kayıt başlatma sorunsuz (RMS 0,09–0,14, peak 0.9354). (b) Kayıt sürerken AirPods bağlanıp çıkarıldı (varsayılan çıkış hoparlör → AirPods → hoparlör): `track.ended` **gelmedi**, `muted` olmadı, bağlanma anında boşluk yok; çıkarmada oluşan ~3 sn sessizlik macOS'un videoyu duraklatmasından (kullanıcı notu). Loopback varsayılan çıkış değişimini sessizce takip ediyor. **Tasarım etkisi:** spec'teki "çıkış cihazı değişince Recording durur" senaryosu oluşmuyor; `onEnded` yalnızca izin geri alınması gibi gerçek kopmalar için kalır. |
| Zoom çıkışı varsayılan olmayan cihazda | **Sessiz değil, yakalanıyor.** Varsayılan çıkış MacBook hoparlörü, Teams hoparlörü AirPods (ses yalnızca AirPods'tan duyuldu; kullanıcı teyidi): Teams test sesi çalarken `rms/sn` 0,045–0,109, `peak` 0.775. Loopback çıkış cihazından bağımsız tüm sistem sesini alıyor. **Tasarım etkisi:** spec'teki "yalnızca varsayılan çıkış" varsayımı çürüdü; "Toplantı sesi duyulmadı" uyarısı metni ve açıklamaları buna göre değişti. |
| Aylık izin yenileme istemi | _Şimdi ölçülemez (aylık döngü); ilk kullanımdan bir ay sonra izlenecek. İstem gelirse kayıt sırasında `ended` mı sessizlik mi olduğuna bakılır._ |

### Ek gözlemler (ilk ölçüm turu)

- Loopback track ayarları varsayılan olarak `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`, `sampleRate: 48000`, `channelCount: 1` bildirdi (`restrictOwnAudio` kutusu işaretli değildi, `false`). `navigator.mediaDevices.getSupportedConstraints().restrictOwnAudio === true`.
- 27,6 sn'lik kayıtta tepe seviyesi **1.0136** (> 1.0: kırpılma riski), RMS ~0,1–0,24. Otomatik kazanç şüphesi: bu yüzden `MacLoopbackSource` kısıtları `echoCancellation/noiseSuppression/autoGainControl: false` olarak güncellendi ve prototipe "işlemeyi kapat" kutusu eklendi; karşılaştırma ölçülecek.
- Sessizlik ve ses ayrımı çalışıyor: Safari çalmaya başlayana kadar `rms/sn = 0.00000`, sonra 0,04–0,24.
- **İşleme kapalı (ölçüm 2):** `echoCancellation/noiseSuppression/autoGainControl: false` verilince ayarlar gerçekten `false`, track **stereo** (`channelCount: 2`, önceden işleme açıkken 1), `peak` **0.9277** (kırpılma yok), RMS 0,09–0,14. Karar: `MacLoopbackSource` bu üç kısıtı kapalı ister (yapıldı).
- **Prototip hatası:** `rms/sn` sayaçları yeni kayıtta sıfırlanmıyor; ilk saniyenin değeri önceki kaydın artığıyla kirleniyor (160.7 sn'deki 0,068; kayıt boyunca `peak = 0.0000`). Ölçümleri etkilemiyor.
- Kayıt sırasında `devicechange` olayları geldi (iPhone mikrofonu Continuity ile görünüp kayboldu); track `ended` olmadı. Giriş cihazı listesindeki değişiklik sistem sesi akışını etkilemiyor.
- **macOS bölüm adı (ekran görüntüsü):** Sistem Ayarları › Gizlilik ve Güvenlik › **Ekran ve Sistem Ses Kaydı** (İngilizce: *Screen & System Audio Recording*). Sayfada iki liste var: *Screen & System Audio Recording* ve **System Audio Recording Only**; prototip ikincisinde göründü (ekran görüntüsü yakalamadan yalnızca ses izni). Uygulamadaki yönlendirme metni buna göre düzeltildi.
