Status: resolved
Blocked by: 01

# Recording sırasında mikrofon koparsa varsayılana geçiş

Spec: [../spec.md](../spec.md) → "Recording sırasında mikrofon koparsa", "Doğrulanmamış varsayımlar"

Bugün mikrofon track'i `ended` olunca Recording biter. Yeni davranış: Recording sürer, kaynak sistem varsayılanı mikrofonu açar ve aynı kanala yazmaya devam eder. Kopma süresi sessizlikle doldurulur ki `mic.wav`, `system.wav` ile aynı zaman çizgisinde kalsın.

## Yapılacaklar

- `mic-source.ts` / `pcm-pipeline.ts`: PCM hattının `AudioContext` ve worklet'i Recording boyunca açık kalır; track `ended` olunca yeni bir `getUserMedia` (kimliksiz, sistem varsayılanı) ve yeni `MediaStreamSource` aynı worklet düğümüne bağlanır. Eski akışın track'leri kapatılır.
- Worklet girişi yokken (`inputs[0][0]` yok) 128 örneklik sıfır bloğu üretir; böylece kopma ile yeni cihazın açılması arasındaki süre `AudioContext` saatiyle sessizlik olarak yazılır. Doğrulama: kopma sırasında Chrome'un `ended` track'i zaten sıfır akıtıyorsa değişiklik gerekmez; hangisi geçerliyse test edilir.
- Geçiş başarılıysa `AudioSource` bir "geçildi" olayı verir (arayüze: yeni bir `onSwitched` ya da mevcut handler'a seçenek). Kullanıcıya bir kez toast: "Mikrofon kesildi, varsayılan mikrofona geçildi." Sessiz mikrofon sayacı sıfırlanır.
- Yeni cihaz açılamazsa (cihaz yok, `NotAllowedError`, açma zaman aşımı) `onEnded` bugünkü gibi çağrılır: Recording biter, `interrupted: { channel: 'mic' }` kalır, "Mikrofon kesildi" uyarısı çıkar.
- Elle `stop()` sonrası ya da geçiş sürerken `stop()` çağrılırsa yeni açılan akış sızdırılmaz (açılış `openWithTimeout` ile; geç gelen akış kapatılır).
- Sistem sesi kaynağının kopması etkilenmez: o kanal bugünkü gibi Recording'i bitirir.

## Kabul kriterleri

- [x] Birim testi (sahte `getUserMedia` ve sahte PCM hattı): `ended` → ikinci `getUserMedia` kimliksiz çağrılır, `onEnded` çağrılmaz, "geçildi" bildirilir.
- [x] Birim testi: ikinci açma hata verirse `onEnded` çağrılır; geçiş sırasında `stop()` akışı sızdırmaz.
- [x] `recorder-controller` testi: mikrofon geçişi Recording'i bitirmez, `interrupted` kalmaz; sistem sesi kopması hâlâ Recording'i bitirir.
- [ ] Geçiş sonrası `mic.wav` süresi ile `system.wav` süresi arasındaki fark kopma süresinden büyük değildir (elle, issue 04).
- [x] `docs/tuning.md` ve `docs/meeting-lifecycle.md` ("Recording sırasında kopma") yeni davranışı anlatır.

## Uygulama notu

Kod tamamlandı; `pnpm typecheck`, `eslint src` ve birim testleri (416 test) temiz. Gerçek cihaz doğrulaması [issue 04](04-device-verification.md)'te.

- `pcm-capture.worklet.ts`: giriş yokken (`inputs[0]` boş) 128 örneklik sıfır bloğu işler; kopma ile yeni cihazın açılması arasındaki süre `AudioContext` saatiyle sessizlik olarak yazılır.
- `pcm-pipeline.ts`: `PcmPipeline.replaceStream(next)` aynı worklet düğümüne yeni `MediaStreamSource` bağlar, eskisini keser ve eski track'leri kapatır.
- `mic-source.ts`: track `ended` olunca kimliksiz `getUserMedia` ile varsayılan mikrofon açılır; başarılıysa `onSwitched` + `onFallback({ reason: 'disconnected' })`, açılamazsa (`NotAllowedError`, cihaz yok, zaman aşımı) `onEnded`. `stop()` sırasında gecikmeli gelen akış kapatılır; `stop()` sonrası `ended` yok sayılır.
- `AudioSourceHandlers.onSwitched` (isteğe bağlı) → `recorder-controller` sessiz mikrofon sayacını `SilenceMonitor.reset()` ile sıfırlar ve uyarıyı kaldırır. Sistem sesi kopması bugünkü gibi Recording'i bitirir.
- `docs/meeting-lifecycle.md` ("Recording sırasında kopma") ve `docs/tuning.md` ("Mikrofon geçişi sessizlik dolgusu") güncellendi.
- Testler: `mic-source.test.ts`, `recorder-controller.test.ts` (`onSwitched` senaryosu).
- Açık: Chrome'un `ended` olmuş track'inin zaten sıfır akıtıp akıtmadığı ölçülmedi; worklet dolgusu her iki durumda da süreyi korur.
