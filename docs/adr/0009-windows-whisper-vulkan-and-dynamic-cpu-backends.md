---
status: accepted
---

# Windows'ta whisper-cli Vulkan ve çalışma anında seçilen CPU backend'leriyle, dll'leriyle birlikte dağıtılır

Windows x64'te `whisper-cli.exe`, ADR-0004'teki aynı whisper.cpp tag'inden ggml'in dinamik backend yüklemesiyle derlenir (`GGML_BACKEND_DL=ON`). Pakette bir Vulkan backend'i (`ggml-vulkan.dll`) ve her CPU komut seti için bir CPU backend'i (`GGML_CPU_ALL_VARIANTS=ON`, `ggml-cpu-*.dll`) bulunur. ggml çalışma anında Vulkan sürücüsü varsa GPU'yu (NVIDIA, AMD ya da Intel), yoksa makinenin desteklediği en iyi CPU varyantını seçer; kullanıcı bir seçim yapmaz. Binary tek dosya değildir: `whisper-cli.exe`, `whisper.dll` ve `ggml*.dll` dosyaları `resources/bin/win32-x64/` altında birlikte durur ve pakete `win.extraResources` ile girer.

MSVC runtime statik bağlanır (`CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded`); kullanıcıdan VC++ Redistributable istenmez. `whisper-cli.exe`'ye `activeCodePage` değeri UTF-8 olan bir manifest gömülür. Bunun nedeni şu: Node argümanları UTF-16 olarak geçirir, ama whisper'ın `main(argc, argv)` girişi bunları sistemin ANSI kod sayfasına çevirir. Kod sayfası bir karakteri karşılamazsa (ör. kullanıcı adındaki `ç`) model, WAV ve çıktı yolları açılamaz. Model, kayıtlar, geçici klasör ve per-user kurulumda uygulamanın kendisi kullanıcı profilinin altında durduğu için bu yaygın bir durumdur.

## Considered Options

- **Yalnızca CPU, statik tek dosya**: macOS'taki "tek statik binary" düzenini korur, ama Windows'ta Metal'in karşılığı olmadan Transcription GPU'lu makinelerde de yavaş kalır.
- **CUDA**: yalnızca NVIDIA'da çalışır ve cuBLAS dll'leri paketi yüzlerce MB büyütür. AMD ve Intel GPU'lu dizüstülerde fayda sağlamaz.
- **Ayrı binary'ler (CPU, Vulkan, CUDA) ve uygulama içinde seçim**: seçim mantığı ve test yükü uygulamaya geçer; ggml'in çalışma anındaki backend seçimi aynı işi yapar.
- **Türkçe karakterli yollar için 8.3 kısa yollar**: bazı sistemlerde 8.3 adları kapalıdır.
- **Türkçe karakterli yollar için dosyaları ASCII bir klasöre kopyalamak**: her Transcription'da büyük WAV ve model kopyası gerekir; geçici klasörün kendisi de profilin altındadır.

## Consequences

- ADR-0004'teki "her platform için ayrı binary" sonucu somutlaşır: binary'ler `resources/bin/<platform>-<arch>/` altındadır ve `getWhisperPaths` platformu ve mimariyi parametre olarak alır.
- Windows derlemesi için Git, CMake, Visual Studio Build Tools (C++ iş yükü) ve Vulkan SDK gerekir. Windows binary'si bir Windows makinesinde, macOS binary'si bir Mac'te derlenir.
- `vulkan-1.dll` pakete girmez; GPU sürücüsüyle gelir. Yoksa ggml Vulkan backend'ini yüklemez ve CPU'yla devam eder.
- Derleme doğrulaması `dumpbin /dependents` ile yapılır: sistem dll'leri, aynı klasördeki dll'ler ve `vulkan-1.dll` dışında bağımlılık hata sayılır. ASCII dışı karakterli bir klasörden ve yoldan çalıştırılan bir duman testi manifest'i ve dll yüklemesini birlikte doğrular.
- Vulkan çalışırken CPU thread'leri ikincildir. Windows'ta whisper thread sayısı mantıksal çekirdeklerin dörtte biridir, en az 2 (`docs/tuning.md`).
- whisper.cpp sürümü güncellenirken iki platformun derlemesi ve duman testi birlikte yapılır.
