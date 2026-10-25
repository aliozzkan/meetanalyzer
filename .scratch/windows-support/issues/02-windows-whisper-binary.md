Status: ready-for-agent
Blocked by: 01

# Windows whisper binary'si

Spec: [../spec.md](../spec.md) → "Windows'ta whisper binary'si (ADR-0009)", "Thread sayısı ve öncelik", "Doğrulanmamış varsayımlar"

Karar kaydı: [ADR-0009](../../../docs/adr/0009-windows-whisper-vulkan-and-dynamic-cpu-backends.md). Windows makinesinde Git, CMake, Visual Studio Build Tools (C++ iş yükü) ve Vulkan SDK kurulu olmalıdır.

## Yapılacaklar

- `build-whisper.mjs` win32-x64 dalı:
  - Ön kontrol: `git`, `cmake`, `dumpbin`, `mt` ve Vulkan SDK (`VULKAN_SDK`) yoksa adıyla söylenir. `dumpbin` ve `mt` için Visual Studio geliştirici ortamı gerekiyorsa betik bunu `vswhere` ile bulur ya da nasıl açılacağını söyler.
  - Aynı tag ve commit'ten kaynak.
  - CMake: `GGML_BACKEND_DL=ON`, `GGML_CPU_ALL_VARIANTS=ON`, `GGML_VULKAN=ON`, `GGML_NATIVE=OFF`, `BUILD_SHARED_LIBS=ON`, `CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded`, testler ve server kapalı. MSVC derleyemezse clang-cl araç seti; sonuç ADR-0009'a not düşülür.
  - `whisper-cli.exe` ve dll'ler `resources/bin/win32-x64/` altına kopyalanır; klasördeki eski dosyalar önce silinir.
  - `whisper-cli.exe`'ye `activeCodePage` = UTF-8 manifest'i `mt.exe` ile gömülür.
- Doğrulama (derlemeden sonra; `--check` modu en azından dosyaların varlığını ve VAD SHA-256'sını denetler):
  - `dumpbin /dependents`: sistem dll'leri, aynı klasördeki dll'ler ve `vulkan-1.dll` dışında bağımlılık yok. `MSVCP*` / `VCRUNTIME*` hata.
  - `--help` çıktısında `--vad`.
  - ASCII dışı karakterli geçici bir klasöre kopyalanıp ASCII dışı karakterli yoldaki kısa bir WAV ve VAD modeliyle çalıştırılır; JSON çıktısı yazılmış olmalıdır. Kısa WAV betik içinde üretilebilir (sessizlik yeterli: amaç yolların açılması ve çıktının yazılması).
- `cpu.ts`: Windows'ta performans çekirdeği tahmini `max(1, floor(mantıksal / 2))`. `whisperThreads` değişmez.
- `docs/tuning.md`: Windows derleme ayarları için yeni satır; thread satırına Windows hesabı; whisper.cpp sürümü satırında güncelleme adımına Windows derlemesi eklenir.
- Spec'teki "Doğrulanmamış varsayımlar"ın issue 02 maddeleri ölçülür ve sonuçları spec'e yazılır.

## Kabul kriterleri

- [ ] Windows'ta `pnpm build:whisper` `resources/bin/win32-x64/` altına `whisper-cli.exe` ve dll'leri üretir; tüm doğrulamalar geçer.
- [ ] `pnpm check:whisper` Windows'ta binary ve model hazırsa geçer, eksikse "önce `pnpm build:whisper`" der.
- [ ] `pnpm dev` ile Windows'ta, kullanıcı adında Türkçe karakter olan bu makinede, kısa bir Meeting transcribe olur.
- [ ] `vulkan-1.dll` olmayan bir ortamda (GPU'suz sanal makine ya da dll'i geçici olarak gizleyerek) Transcription CPU'da tamamlanır.
- [ ] `cpu.ts` için Windows hesabının birim testi var (8 ve 16 mantıksal çekirdek → 2 ve 4 whisper thread'i).
- [ ] ADR-0009 ve `docs/tuning.md` ölçülen sonuçlarla uyumludur.
