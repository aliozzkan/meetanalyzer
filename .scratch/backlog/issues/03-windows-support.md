Status: resolved

# Windows desteği

İlk hedef macOS (Apple Silicon). Windows için: whisper-cli binary'si (CPU / CUDA / Vulkan seçimi), loopback davranışı, mikrofon izni, power assertion farkları, NSIS paketleme.

## Comments

**2026-10-11 (issue 06'dan):** `electron-builder.yml` → `asarUnpack: resources/**` ve `files` her platformun paketine `resources/bin/whisper-cli` (şimdilik yalnızca macOS arm64 Mach-O) dosyasını da katar. Windows/Linux eklenirken `resources/bin` platforma göre ayrılmalı (ör. `mac.extraResources` / platform alt klasörleri) ve `getWhisperPaths` platforma duyarlı olmalı; `check:whisper` da platforma göre çalışmalı.

**2026-10-25:** Spec'e taşındı: [../../windows-support/spec.md](../../windows-support/spec.md). Kapsam Windows 10/11 x64, kullanıcı başına imzasız NSIS. whisper Vulkan ve çalışma anında seçilen CPU backend'leriyle derlenir ([ADR-0009](../../../docs/adr/0009-windows-whisper-vulkan-and-dynamic-cpu-backends.md)). Binary'ler `resources/bin/<platform>-<arch>/` altına ayrılır ve her platformun kendi `extraResources` ayarıyla pakete girer (issue 01). Windows loopback'i sistem sesi dilimine bağlı son iki issue'dur. arm64 ve code signing ayrı maddeler: [11](11-windows-arm64.md), [12](12-windows-code-signing.md).
