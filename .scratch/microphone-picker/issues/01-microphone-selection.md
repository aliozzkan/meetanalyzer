Status: resolved

# Mikrofon seçimi: ayar, cihaz listesi ve seçili cihazla kayıt

Spec: [../spec.md](../spec.md) → "Seçim", "Seçili cihaz bağlı değil"

Kullanıcı Ayarlar'dan mikrofon seçer; Recording o cihazla başlar. Seçili cihaz bağlı değilse kayıt engellenmez, sistem varsayılanıyla devam eder ve kullanıcıya haber verilir.

## Yapılacaklar

- Main: `settings-service`'e mikrofon seçimi eklenir. İki anahtar: cihaz kimliği ve cihaz adı (etiket). `null` = "Sistem varsayılanı". IPC'den gelen değer doğrulanır (`invalid-input`), mevcut `setDefaultLanguage` kalıbı. Preload ve `@shared/settings` tipleri güncellenir.
- Renderer: ses giriş cihazlarını `enumerateDevices` ile listeleyen ve `devicechange`'i dinleyen bir hook. Etiket boşsa (izin yok) yalnızca "Sistem varsayılanı" ve bir açıklama gösterilir.
- Ayarlar › Genel'e "Mikrofon" alanı (Default Language alanı gibi bir `NativeSelect`). Kaydedilmiş cihaz listede yoksa "X (bağlı değil)" seçeneği olarak gösterilir.
- `createMicSource` bir cihaz kimliği alır. Kimlik varsa `deviceId: { exact }` ile açar; `OverconstrainedError` (cihaz yok) olursa kimliksiz yeniden dener ve bunu üst katmana bildirir. Diğer hatalar (`NotAllowedError` dahil) bugünkü gibi iletilir.
- Varsayılana düşüldüğünde kullanıcıya bir kez toast: "«X» bulunamadı, sistem varsayılanı mikrofon kullanıldı." Ayardaki seçim silinmez.
- `useRecorder` kaynağı kurarken güncel seçimi okur (`createSources` her Recording için yeniden çağrılır).

## Kabul kriterleri

- [ ] Ayarlarda "Sistem varsayılanı" ve bağlı giriş cihazları listelenir; seçim uygulama yeniden açılınca korunur.
- [ ] Seçili cihazla başlatılan Recording o cihazın sesini yazar; "Sen" göstergesi o cihazla hareket eder.
- [ ] Seçili cihaz bağlı değilken Recording başlar, varsayılan mikrofon kullanılır, toast gösterilir ve ayar bozulmaz; cihaz geri takılınca sonraki Recording onu kullanır.
- [ ] Mikrofon izni reddedilmişse bugünkü "Mikrofon erişimi verilmedi" akışı değişmez (`OverconstrainedError` ile karışmaz).
- [x] Birim testleri: ayar servisi (geçerli/geçersiz değer, `null`), `createMicSource` kısıt üretimi ve düşme mantığı (sahte `getUserMedia` ile), cihaz listesi hook'unun etiket yokken davranışı.
- [x] Mevcut `recorder-controller` testleri değişmeden geçer.

## Uygulama notu

Kod tamamlandı; `pnpm typecheck`, `eslint src` (hata yok) ve birim testleri temiz. Elle doğrulama [issue 04](04-device-verification.md)'te.

- `MicrophoneSelection { deviceId, label }` (`src/shared/settings.ts`); main `settings-service`'te `getMicrophone` / `setMicrophone` (`microphone_device_id`, `microphone_label` anahtarları, `null` seçimi siler, IPC girdisi doğrulanır).
- Renderer: `microphone-devices.ts` (cihaz listesi + seçenekler; `default`/`communications` sanal girişleri atılır), `use-microphone.ts` (uygulama kabuğunda bir kez; `devicechange` ve pencere odağında liste yenilenir), `microphone-select.tsx` (ortak seçici). Ayarlar › Genel'e "Mikrofon" alanı eklendi.
- `createMicSource({ selection, onFallback })`: `deviceId: { exact }` ile açar; `OverconstrainedError`/`NotFoundError` olursa kimliksiz yeniden dener ve `onFallback({ reason: 'not-found', label })` ile haber verir (`use-recorder` toast gösterir). `NotAllowedError` ve zaman aşımı olduğu gibi iletilir.
- Testler: `settings-service.test.ts`, `microphone-devices.test.ts`, `mic-source.test.ts`.
