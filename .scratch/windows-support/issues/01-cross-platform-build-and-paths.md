Status: ready-for-agent

# Platformdan bağımsız geliştirme, whisper betiği ve kaynak yolları

Spec: [../spec.md](../spec.md) → "Geliştirme ortamı", "whisper derleme script'i", "Kaynak düzeni ve paketleme"

Davranış değişikliği yok: macOS'ta derleme, paketleme ve Transcription bugünkü gibi çalışır. Bu issue Windows dalını derlemez; issue 02'nin üzerine kuracağı iskeleti hazırlar.

## Yapılacaklar

- `scripts/run-tests.mjs`: Electron binary'sini `ELECTRON_RUN_AS_NODE=1` ortamıyla vitest'i (`run`) çalıştıracak şekilde başlatır, argümanları iletir, çıkış kodunu döndürür. `package.json` → `test` bunu çağırır.
- `scripts/build-whisper.sh` → `scripts/build-whisper.mjs`. Sürüm sabitleri tek yerde durur, SHA-256 `crypto` ile hesaplanır. `--check` modu korunur. darwin-arm64 dalı bugünkü script'in adımlarını aynen yapar. win32-x64 dalı bu issue'da "henüz desteklenmiyor (issue 02)" diyerek çıkar. Diğer platformlarda desteklenmediğini söyler.
- `package.json`: `build:whisper` ve `check:whisper` Node betiğini çağırır. `build:win` önce `check:whisper` çalıştırır.
- Binary yeri: `resources/bin/darwin-arm64/whisper-cli`. Betik bu yola yazar ve bu yolu kontrol eder.
- `electron-builder.yml`: `files`'tan `resources/bin/**` çıkarılır. `mac.extraResources`: `resources/bin/darwin-arm64` → `bin`. `win.extraResources`: `resources/bin/win32-x64` → `bin` (klasör issue 02'de dolar). `asarUnpack: resources/**` ikon ve VAD modeli için kalır.
- `getWhisperPaths`: `platform` ve `arch` alır. Paketli: `<resourcesPath>/bin/whisper-cli[.exe]`; geliştirme: `<appPath>/resources/bin/<platform>-<arch>/whisper-cli[.exe]`. VAD modelinin yolu değişmez. Desteklenmeyen çift açık bir hata verir. Çağıran (`index.ts`) `process.platform` ve `process.arch` geçirir.
- `version.test.ts` tag'i `build-whisper.mjs`'ten okur. `src/main/config.ts` ve `docs/tuning.md`'deki `build-whisper.sh` referansları yeni dosyayı gösterir.

## Kabul kriterleri

- [ ] `pnpm test`, `lint` ve `typecheck` Windows'ta ve macOS'ta çalışır.
- [x] `paths.test.ts`: darwin-arm64 ve win32-x64 için paketli ve geliştirme yolları, `.exe` uzantısı ve desteklenmeyen çift için hata test edilir.
- [x] `pnpm check:whisper` Windows'ta açık bir "henüz desteklenmiyor" mesajıyla, binary eksik olan macOS'ta "önce `pnpm build:whisper`" mesajıyla başarısız olur.
- [ ] macOS'ta `pnpm build:whisper` binary'yi `resources/bin/darwin-arm64/` altına derler, `build:mac` ile paketlenen uygulama Transcription yapar. Bu kriter bir Mac'te doğrulanır; Windows makinesinde test edilemez.
- [ ] Paketlenmiş macOS uygulamasında `Contents/Resources/bin/whisper-cli` bulunur; asar'ın içinde ve dışında başka bir kopyası yoktur.

## Comments

**2026-10-25:** Windows'ta uygulandı. Commit edilmedi.

- `scripts/run-tests.mjs`: vitest'i Electron'un Node'uyla, `ELECTRON_RUN_AS_NODE=1` ortamıyla çalıştırır. Windows'ta 34 test dosyası geçer. Sahte whisper'ı kabuk betiği olan 6 çalıştırıcı testi Windows'ta atlanır (`itPosix`); çalıştırıcının Windows yolu issue 02'deki gerçek binary'yle doğrulanır.
- Windows'ta görünen iki test hatası düzeltildi. `recording-service.test.ts` göreli yolu `join` ile bekler, çünkü yol DB'ye platformun ayracıyla yazılır. `recovery.test.ts` onarım hatasını salt okunur bir dosyayla üretir; bu yöntem macOS'ta ve Windows'ta aynı sonucu verir.
- `scripts/build-whisper.mjs` bash script'in yerini aldı. VAD indirme, SHA-256 doğrulaması, tekrar çalıştırmada indirmeme ve `--check` mesajları Windows'ta betiğin bir kopyasıyla denendi. win32-x64 dalı "henüz desteklenmiyor" der.
- `getWhisperPaths` `platform` ve `arch` alır. Yollar hedef platformun ayracıyla kurulur (`path.win32` / `path.posix`), böylece testler her makinede aynı sonucu verir. Desteklenmeyen platformda `whisper-missing` hatası verir. `index.ts` yolları her Transcription'da çözer, bu yüzden hata uygulamayı açılışta düşürmez.
- `electron-builder --dir --win` sahte bir `whisper-cli.exe` ile denendi: binary asar dışında `resources/bin/whisper-cli.exe` olarak duruyor; asar'da ve `app.asar.unpacked`'da `bin` yok.
- `pnpm dev` Windows'ta main process hatası olmadan açılıyor.
- `eslint.config.mjs`: `scripts/**/*.mjs` için dönüş tipi kuralı kapalı.
- Kalan: macOS kriterleri bir Mac'te doğrulanmalı (macOS'ta `pnpm test`, `pnpm build:whisper`, `build:mac` ve paketteki `Contents/Resources/bin/whisper-cli`).
- Not: `core.autocrlf=true` olan bu checkout'ta `pnpm lint` hatasız biter ama her dosya için CRLF uyarısı verir (~18 000). `.gitattributes`'a `* text=auto eol=lf` eklemek bu uyarıları kaldırır.
