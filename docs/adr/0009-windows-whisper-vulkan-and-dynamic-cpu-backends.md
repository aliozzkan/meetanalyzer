---
status: accepted
---

# Windows'ta whisper-cli Vulkan ve çalışma anında seçilen CPU backend'leriyle, dll'leriyle birlikte dağıtılır

Windows x64'te `whisper-cli.exe`, ADR-0004'teki aynı whisper.cpp tag'inden ggml'in dinamik backend yüklemesiyle derlenir (`GGML_BACKEND_DL=ON`). Pakette bir Vulkan backend'i (`ggml-vulkan.dll`) ve her CPU komut seti için bir CPU backend'i (`GGML_CPU_ALL_VARIANTS=ON`, `ggml-cpu-*.dll`) bulunur. ggml çalışma anında Vulkan sürücüsü varsa GPU'yu (NVIDIA, AMD ya da Intel), yoksa makinenin desteklediği en iyi CPU varyantını seçer; kullanıcı bir seçim yapmaz. Binary tek dosya değildir: `whisper-cli.exe`, `whisper.dll` ve `ggml*.dll` dosyaları `resources/bin/win32-x64/` altında birlikte durur ve pakete `win.extraResources` ile girer.

MSVC runtime statik bağlanır (`CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded`); kullanıcıdan VC++ Redistributable istenmez. Aynı nedenle OpenMP kapalıdır (`GGML_OPENMP=OFF`; açık olsaydı CPU backend'leri `vcomp140.dll`'e bağlanırdı); ggml kendi thread havuzunu kullanır. `whisper-cli.exe`'ye `activeCodePage` değeri UTF-8 olan bir manifest gömülür; böylece whisper argümanları ve dosya yollarını sistemin ANSI kod sayfası yerine UTF-8 olarak işler. Manifest olmadan whisper-cli ASCII dışı karakterli yollardaki dosyaları açamıyor: Türkçe kod sayfalı (1254) bir makinede Kiril harfli yolda hata verip çıkıyor, Türkçe harfli yolda (`ç`, `ğ`, `ş`) çöküyor. Manifest'li binary ikisinde de çalışıyor. Model, kayıtlar, geçici klasör ve per-user kurulumda uygulamanın kendisi kullanıcı profilinin altında durduğu için kullanıcı adında Türkçe harf olan herkes bundan etkilenir.

## Considered Options

- **Yalnızca CPU, statik tek dosya**: macOS'taki "tek statik binary" düzenini korur, ama Windows'ta Metal'in karşılığı olmadan Transcription GPU'lu makinelerde de yavaş kalır.
- **CUDA**: yalnızca NVIDIA'da çalışır ve cuBLAS dll'leri paketi yüzlerce MB büyütür. AMD ve Intel GPU'lu dizüstülerde fayda sağlamaz.
- **Ayrı binary'ler (CPU, Vulkan, CUDA) ve uygulama içinde seçim**: seçim mantığı ve test yükü uygulamaya geçer; ggml'in çalışma anındaki backend seçimi aynı işi yapar.
- **Türkçe karakterli yollar için 8.3 kısa yollar**: bazı sistemlerde 8.3 adları kapalıdır.
- **Türkçe karakterli yollar için dosyaları ASCII bir klasöre kopyalamak**: her Transcription'da büyük WAV ve model kopyası gerekir; geçici klasörün kendisi de profilin altındadır.

## Consequences

- ADR-0004'teki "her platform için ayrı binary" sonucu somutlaşır: binary'ler `resources/bin/<platform>-<arch>/` altındadır ve `getWhisperPaths` platformu ve mimariyi parametre olarak alır.
- Windows derlemesi için Git, Visual Studio ya da Build Tools (C++ iş yükü; CMake, Ninja, `dumpbin` ve `mt` dahil) ve Vulkan SDK gerekir. Derleyici MSVC'dir. Windows binary'si bir Windows makinesinde, macOS binary'si bir Mac'te derlenir.
- `vulkan-1.dll` pakete girmez; GPU sürücüsüyle gelir. Yoksa ggml Vulkan backend'ini yüklemez ve CPU'yla devam eder.
- Derleme doğrulaması `dumpbin /dependents` ile yapılır: sistem dll'leri, aynı klasördeki dll'ler ve `vulkan-1.dll` dışında bağımlılık hata sayılır. ASCII dışı karakterli bir klasörden ve yoldan çalıştırılan bir duman testi manifest'i ve dll yüklemesini birlikte doğrular.
- Vulkan çalışırken CPU thread'leri ikincildir. Windows'ta whisper thread sayısı mantıksal çekirdeklerin dörtte biridir, en az 2 (`docs/tuning.md`).
- Windows paketi ~59 MB'tır; bunun ~45 MB'ı derlenmiş Vulkan shader'larını taşıyan `ggml-vulkan.dll`'dir.
- whisper.cpp sürümü güncellenirken iki platformun derlemesi ve duman testi birlikte yapılır.
