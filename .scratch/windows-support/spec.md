# Windows desteği

Uygulama bugün yalnızca macOS Apple Silicon'da kurulup çalışıyor. Bu dilimle Windows 10/11 x64'te de aynı akış çalışır: mikrofonla Recording → Transcription → Correction → Approve. Uygulama kullanıcı başına kurulan bir NSIS installer ile dağıtılır. Repo Windows'ta da geliştirilebilir hale gelir. Sistem sesi kaydının Windows karşılığı bu dilimin son iki issue'sudur; ikisi de [sistem sesi dilimine](../system-audio/spec.md) bağlıdır.

Terimler [GLOSSARY.md](../../GLOSSARY.md), durumlar [docs/meeting-lifecycle.md](../../docs/meeting-lifecycle.md), sayısal değerler [docs/tuning.md](../../docs/tuning.md) ile aynıdır. İlgili kararlar: ADR-0004 (whisper sidecar binary), [ADR-0009](../../docs/adr/0009-windows-whisper-vulkan-and-dynamic-cpu-backends.md) (Windows'ta whisper derlemesi). Kaynak not: [backlog 03](../backlog/issues/03-windows-support.md).

## Mevcut durum

- `scripts/build-whisper.sh` bash ile yazılmıştır ve yalnızca macOS arm64'te çalışır (`uname` kontrolü, `otool`, `shasum`, `sysctl`). `pnpm check:whisper` de bu script'i bash ile çağırır. `src/main/whisper/version.test.ts` whisper.cpp tag'ini bu dosyadan okur.
- `resources/bin/whisper-cli` tek bir macOS Mach-O dosyasıdır. `electron-builder.yml` → `asarUnpack: resources/**` bu dosyayı her platformun paketine katar. `getWhisperPaths` (`src/main/whisper/paths.ts`) platformu bilmez, `.exe` uzantısı yoktur.
- `performanceCoreCount` (`src/main/transcription/cpu.ts`) `sysctl` okuyamayınca mantıksal çekirdek sayısını döndürür. Hyper-threading'li bir Windows makinesinde whisper bu yüzden fiziksel çekirdeklerin tamamı kadar thread alır.
- `requestMicrophoneAccess` (`src/main/recordings/microphone.ts`) macOS dışında her zaman `'granted'` döndürür. `MICROPHONE_SETTINGS_URL` yalnızca macOS Sistem Ayarları'nı açar.
- `test` script'i `ELECTRON_RUN_AS_NODE=1 electron …` biçimindedir. Bu POSIX söz dizimini Windows'taki pnpm (cmd) çalıştıramaz.
- Pencere Windows'ta yerel başlık çubuğuyla açılır; 44 px'lik header onun altında ikinci bir bant olur. `autoHideMenuBar` açıktır.
- Windows'ta son pencere kapanınca uygulama kapanır (`window-all-closed`). Sürmekte olan Recording düzgünce durdurulur, çalışan Transcription öldürülür ve kullanıcıya bir şey sorulmaz. macOS'ta Cmd+Q aynı şekilde sessizce kapatır.
- `setAppUserModelId('com.electron')` Electron şablonundan kalmıştır. Windows görev çubuğu gruplaması ve bildirimler bu kimliğe bakar.

## Kapsam

- **Platform:** Windows 10 22H2 ve Windows 11, yalnızca x64.
- **Akış:** macOS'taki mikrofonla Recording, Transcription, Correction ve Approve akışının tamamı.
- **Dağıtım:** kullanıcı başına, tek tıklamalı NSIS installer (admin istemez), imzasız, otomatik güncelleme yok. İmzasız installer SmartScreen uyarısı verir; bu kabul edilir.
- **Geliştirme:** `pnpm dev`, `test`, `lint`, `typecheck`, `check:whisper`, `build:whisper` ve `build:win` Windows'ta çalışır. macOS'taki davranış değişmez.
- **Uygulamayı kapatma onayı:** Recording ya da Transcription sürerken uygulama kapatılırsa onay sorulur. Bu her iki platformda geçerlidir.
- **Sistem sesi (Windows):** bir insan prototipi ve `WindowsLoopbackSource` adapter'ı (issue 07 ve 08).

## Kapsam dışı

- Windows on ARM (arm64): ayrı backlog maddesi ([backlog 11](../backlog/issues/11-windows-arm64.md)).
- Code signing ve SmartScreen itibarı: ayrı backlog maddesi ([backlog 12](../backlog/issues/12-windows-code-signing.md)).
- Otomatik güncelleme.
- CUDA ile hızlandırma (bkz. ADR-0009).
- Tray'e küçülme ve pencere kapalıyken arka planda çalışma.
- Kapak kapatılınca uykuya karşı önlem (macOS'ta da yok).
- Linux.

## Kullanıcı akışı

### Kurulum

- Installer admin istemeden kullanıcının profiline kurar (`%LOCALAPPDATA%\Programs\…`), masaüstü ve Başlat menüsü kısayolu oluşturur. Kaldırma Windows'un "Uygulamalar" listesinden yapılır.
- İlk açılışta model indirme akışı macOS'takiyle aynıdır.

### Mikrofon izni

- Windows izin sorusu göstermez; izin Ayarlar › Gizlilik › Mikrofon › "Masaüstü uygulamalarının mikrofonunuza erişmesine izin verin" anahtarıyla verilir.
- "Kaydı başlat"ta izin durumu okunur. İzin kapalıysa Recording başlamaz ve macOS'taki "izin yok" arayüzü aynen gösterilir. "Ayarları aç" düğmesi Windows'ta mikrofon gizlilik sayfasını açar.

### Pencere

- Header pencerenin en üstündedir. Windows'un küçült, büyüt ve kapat düğmeleri header'ın sağına oturur ve renkleri açık/koyu temaya uyar. Header'ın boş alanından pencere sürüklenir.
- Görünür menü çubuğu yoktur. Ctrl+N (Yeni Meeting) ve Ctrl+, (Ayarlar) kısayolları çalışır; iki komut header'da da vardır.
- Geri ve ileri Windows'ta Alt+← / Alt+→ ile gider (macOS'ta ⌘[ / ⌘]); header'daki ipuçları platformun kısayolunu gösterir.

### Kapatma

- Recording ya da Transcription sürerken uygulama kapatılmak istenirse şu onay sorulur: "Kapatırsan kayıt durur ve transcription iptal olur." Seçenekler "Kapat" ve "Vazgeç"tir. Metin o anda hangisi sürüyorsa ona göre kurulur.
- Windows'ta bu soru pencere kapatılınca (X, Alt+F4) ve menüden ya da kısayolla çıkışta sorulur. macOS'ta Cmd+Q ve menüden çıkışta sorulur; pencereyi kapatmak orada uygulamayı kapatmadığı için soru çıkmaz.
- "Kapat" seçilince bugünkü kapanış işler: Recording düzgünce durdurulur, Transcription öldürülür, Meeting açılışta Closed'a döner. Kullanıcı bir kez onayladıysa aynı kapanışta ikinci kez sorulmaz.

### Transcription

- Akış macOS'takiyle aynıdır. GPU varsa (NVIDIA, AMD ya da Intel) whisper Vulkan'da çalışır; yoksa makinenin desteklediği en iyi CPU varyantında çalışır. Kullanıcı bir seçim yapmaz.

## Teknik tasarım

### Geliştirme ortamı

- `test` script'i küçük bir Node başlatıcısına (`scripts/run-tests.mjs`) taşınır. Başlatıcı Electron binary'sini `ELECTRON_RUN_AS_NODE=1` ortamıyla vitest'i çalıştıracak şekilde başlatır ve çıkış kodunu aynen döndürür. Diğer script'ler zaten platformdan bağımsızdır.
- `build:win`, `build:mac` gibi önce `check:whisper` çalıştırır.

### whisper derleme script'i

- `scripts/build-whisper.sh` bir Node betiğiyle (`scripts/build-whisper.mjs`) değiştirilir. Sürüm sabitleri (whisper.cpp tag'i, commit'i, VAD modelinin dosya adı, revision'ı ve SHA-256'sı) tek yerde durur. SHA-256 Node'un `crypto` modülüyle hesaplanır.
- `pnpm build:whisper` ve `pnpm check:whisper` bu betiği çalıştırır. Betik çalıştığı platforma göre dal seçer:
  - **darwin-arm64:** bugünkü bash script'in yaptığının aynısı (Metal, statik, `GGML_NATIVE=OFF`, macOS 13.0, `otool` kontrolü).
  - **win32-x64:** ADR-0009'daki derleme ve doğrulama.
  - Diğer platformlarda desteklenmediğini söyleyerek çıkar.
- Eksik araç adıyla söylenir. Windows için gerekenler: Git, CMake, Visual Studio Build Tools (C++ iş yükü; `dumpbin` ve `mt` dahil) ve Vulkan SDK.
- `version.test.ts` tag'i yeni betikten okur.
- `docs/tuning.md`'deki whisper.cpp sürümü, derleme ayarları ve VAD modeli satırları yeni dosyayı gösterir. Windows derleme ayarları için ayrı bir satır eklenir.

### Windows'ta whisper binary'si (ADR-0009)

- CMake: `GGML_BACKEND_DL=ON`, `GGML_CPU_ALL_VARIANTS=ON`, `GGML_VULKAN=ON`, `GGML_NATIVE=OFF`, `BUILD_SHARED_LIBS=ON`, `CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded`, testler ve server kapalı.
- Çıktı `whisper-cli.exe` ve yanındaki dll'lerdir (`whisper.dll`, `ggml.dll`, `ggml-base.dll`, CPU varyantlarının `ggml-cpu-*.dll`'leri, `ggml-vulkan.dll`). Hepsi `resources/bin/win32-x64/` altına kopyalanır.
- `whisper-cli.exe`'ye `activeCodePage` değeri UTF-8 olan bir manifest gömülür (`mt.exe`). Böylece argümanlar ve `fopen` UTF-8 yolları doğru açar.
- Doğrulama:
  - `dumpbin /dependents` ile `whisper-cli.exe` ve her dll taranır. Yalnızca Windows sistem dll'lerine ve aynı klasördeki dll'lere bağımlılık olmalıdır. `vulkan-1.dll` istisnadır: GPU sürücüsüyle gelir, yoksa ggml Vulkan backend'ini yüklemez ve CPU'yla devam eder. VC++ runtime dll'lerine (`MSVCP*`, `VCRUNTIME*`) bağımlılık hata sayılır.
  - `--help` çıktısında `--vad` bulunmalıdır.
  - Duman testi: binary'ler adında ASCII dışı karakter olan geçici bir klasöre (ör. `çğış`) kopyalanır. Oradan, yine ASCII dışı karakterli bir yoldaki kısa bir WAV ve VAD modeliyle çalıştırılır ve JSON çıktısının yazıldığı doğrulanır. Per-user kurulumda uygulamanın kendisi de kullanıcı profilinin altında durduğu için dll'lerin bu tür bir klasörden yüklenmesi de test edilmiş olur.

### Kaynak düzeni ve paketleme

- Binary'ler platforma göre ayrılır: `resources/bin/darwin-arm64/whisper-cli` ve `resources/bin/win32-x64/{whisper-cli.exe, *.dll}`. VAD modeli platformdan bağımsızdır ve `resources/models/` altında kalır.
- `electron-builder.yml`:
  - `files` listesinden `resources/bin/**` çıkarılır.
  - `mac.extraResources`: `resources/bin/darwin-arm64` → `bin`.
  - `win.extraResources`: `resources/bin/win32-x64` → `bin`.
  - `asarUnpack: resources/**` ikon ve VAD modeli için kalır.
- `getWhisperPaths` platformu ve mimariyi parametre olarak alır:
  - paketli: `<resourcesPath>/bin/whisper-cli[.exe]`
  - geliştirme: `<appPath>/resources/bin/<platform>-<arch>/whisper-cli[.exe]`

  VAD modelinin yolu değişmez. Desteklenmeyen bir platform/mimari çifti açık bir hata verir.

### Thread sayısı ve öncelik

- Windows'ta performans çekirdeği sayısı mantıksal çekirdek sayısının yarısı olarak tahmin edilir (hyper-threading varsayımı). `whisperThreads` hesabı değişmez; sonuç `max(2, floor(mantıksal / 4))`, yani kabaca fiziksel çekirdeklerin yarısı olur. Vulkan çalışırken CPU thread'leri ikincildir. macOS'taki hesap değişmez. `docs/tuning.md`'deki thread satırına Windows hesabı eklenir.
- `os.setPriority(pid, WHISPER_NICE)` Windows'ta da çalışır. Node 10 değerini `BELOW_NORMAL_PRIORITY_CLASS`'a eşler; kod değişmez.
- İptalde `child.kill('SIGTERM')` Windows'ta süreci hemen sonlandırır. Geçici çıktı klasörü yine silinir; kod değişmez.

### Mikrofon izni

- `requestMicrophoneAccess` Windows'ta `systemPreferences.getMediaAccessStatus('microphone')` okur. `denied` dönerse `'denied'` döndürür, diğer durumlarda `'granted'` döndürür. `askForMediaAccess` yalnızca macOS'ta çağrılır.
- Ayarlar linki platforma göre seçilir: macOS'ta bugünkü `x-apple.systempreferences:…`, Windows'ta `ms-settings:privacy-microphone`.

### Pencere ve menü

- Windows'ta `titleBarStyle: 'hidden'` ve `titleBarOverlay` kullanılır. Overlay'in yüksekliği header'la aynıdır (44 px). Renkleri temadan gelir ve tema değişince `setTitleBarOverlay` ile güncellenir.
- Header pencere düğmelerinin altına girmemek için sağda overlay genişliği kadar boşluk bırakır (`env(titlebar-area-width)` ya da sabit genişlik). macOS'taki sol boşluk (`pl-20`) aynen kalır.
- Menü şablonu Windows'ta kurulmaya devam eder; görünmez ama Ctrl+N ve Ctrl+, kısayolları onun üzerinden çalışır.
- `setAppUserModelId` `electron-builder.yml`'deki `appId` ile aynı olur: `com.meetanalyzing.app`.

### Kapatma onayı

- Main'de tek bir karar fonksiyonu vardır: "şu an kapatmak bir şey kaybettirir mi". Fonksiyon Recording servisinden aktif kayıt, kuyruktan çalışan Transcription bilgisini alır ve onay metnini döndürür. Fonksiyon test edilir.
- `before-quit` (her platform) ve Windows'ta ana pencerenin `close` olayı bu fonksiyonu kullanır. Onay alınırsa kapanış devam eder ve aynı kapanışta tekrar sorulmaz.

### Güç

- `prevent-app-suspension` Windows'ta `SetThreadExecutionState` kullanır; kod değişmez. Doğrulaması `powercfg /requests` ile yapılır.

### Sistem sesi (Windows)

- Sistem sesi dilimindeki `AudioSource` arayüzüne bir `WindowsLoopbackSource` eklenir: `getDisplayMedia` ve main'de `setDisplayMediaRequestHandler` → `audio: 'loopback'`. 48 kHz stereo → 16 kHz mono dönüşümü macOS kaynağıyla ortaktır.
- Windows'ta sistem sesi için işletim sistemi izni yoktur. "Sistem sesi izni yok" akışı Windows'ta çıkmaz; bir kerelik bilgilendirme yine gösterilir.
- Uygulamanın kendi sesi (Suspect Word dinletmesi) `system.wav`'a girmemelidir. `restrictOwnAudio` Windows'ta bunu sağlamıyorsa Windows'ta Recording sürerken Suspect Word dinletmesi kapatılır. Düğme bu durumda devre dışı görünür ve kaydın bitmesini beklemek gerektiğini söyler.

## Doğrulanmamış varsayımlar

Issue 02'nin ölçecekleri:

- `GGML_CPU_ALL_VARIANTS` ve `GGML_BACKEND_DL` MSVC ile v1.9.5'te derleniyor mu. Derlenmiyorsa Visual Studio'nun clang-cl araç seti kullanılır ve ADR-0009'a not düşülür.
- ggml, backend dll'lerini ASCII dışı karakterli bir klasörden yükleyebiliyor mu.
- UTF-8 manifest'i whisper'ın model, WAV ve çıktı yollarını açmasına yetiyor mu.
- `vulkan-1.dll` olmayan bir makinede (GPU'suz bir sanal makine) CPU'ya sessizce düşüyor mu.

Sonuçlar (issue 02, 2026-10-25; i7-11800H, RTX 3050 + Intel UHD, Türkçe kod sayfası 1254):

- MSVC (VS 2026) dokuz CPU varyantını (`x64`, `sse42`, `sandybridge`, `haswell`, `skylakex`, `cannonlake`, `cascadelake`, `icelake`, `alderlake`) ve Vulkan backend'ini derliyor; clang-cl gerekmiyor. Tüm binary'ler yalnızca `KERNEL32.dll`'e (Vulkan backend ayrıca `vulkan-1.dll`'e) bağlı.
- ggml backend dll'lerini ASCII dışı karakterli klasörden yüklüyor; yükleme geniş karakterli (UTF-16) yollarla yapılıyor.
- UTF-8 manifest'i gerekli ve yeterli: manifest'siz binary Türkçe harfli yolda çöküyor, Kiril harfli yolda hata verip çıkıyor; manifest'li binary ikisinde de transcribe ediyor.
- CPU yedeği: `ggml-vulkan.dll` kaldırılınca ve `GGML_VK_VISIBLE_DEVICES=-1` ile Vulkan cihazları gizlenince Transcription CPU'da (`ggml-cpu-cascadelake.dll`) aynı sonuçla tamamlanıyor. `vulkan-1.dll`'in hiç olmadığı bir makine denenmedi (bu makinede System32'de duruyor); o durumda da ggml Vulkan backend dll'ini yükleyemez ve aynı yola düşer.
- `os.setPriority(pid, 10)` Windows'ta whisper-cli'yi `BelowNormal` önceliğinde çalıştırıyor; iptal süreci sonlandırıyor.
- Node 22'nin `fs.cpSync`'i Windows'ta ASCII dışı karakterli hedefte süreci düşürüyor; betikler dosyaları tek tek kopyalar.

Issue 07'nin ölçecekleri:

- Windows'ta `audio: 'loopback'` video istemeden yalnızca ses verebiliyor mu.
- `restrictOwnAudio` Windows'ta uygulamanın kendi sesini kayıttan dışlıyor mu.
- Varsayılan çıkış cihazı değişince (kulaklık takma, Bluetooth'a geçiş) akış `ended` mı oluyor, yeni cihazı mı takip ediyor, sessizleşiyor mu.
- Toplantı uygulaması varsayılan olmayan bir cihaza çalarken sistem kanalı sessiz mi.

Sonuçlar bu bölüme not olarak geri yazılır. Tasarımı değiştiren bir sonuç varsa ilgili issue'lar güncellenir.

## Kabul kriterleri

- [ ] Windows 10/11 x64'te NSIS installer admin istemeden kurar; kısayollar oluşur, kaldırma çalışır.
- [ ] Windows'ta mikrofonla Recording → Transcription → Correction → Approve uçtan uca çalışır. Kullanıcı adında Türkçe karakter olan bir hesapta da çalışır.
- [ ] GPU'lu bir makinede whisper Vulkan'da, GPU'suz bir makinede CPU'da çalışır. Kullanıcıdan VC++ Redistributable istenmez.
- [ ] Mikrofon izni kapalıyken Recording başlamaz; "Ayarları aç" Windows mikrofon gizlilik sayfasını açar.
- [ ] Header en üsttedir, pencere düğmeleri header'ın sağındadır, sürükleme çalışır ve tema değişince düğme renkleri uyar.
- [ ] Recording ya da Transcription sürerken uygulamayı kapatmak her iki platformda onay sorar; "Vazgeç" kapanışı iptal eder.
- [ ] Recording sürerken `powercfg /requests` çıktısında uygulama SYSTEM altında görünür, Recording durunca kaybolur.
- [ ] Onaydan sonra ses klasörü silinir. Silme başarısız olursa açılışta yeniden denenir.
- [ ] `pnpm test`, `lint`, `typecheck`, `check:whisper` ve `build:win` Windows'ta çalışır. macOS'ta `build:whisper`, `check:whisper` ve `build:mac` eskisi gibi çalışır.
- [ ] Windows'ta sistem sesi, sistem sesi diliminin kabul kriterlerini Windows'a uyarlanmış haliyle karşılar (issue 08).
