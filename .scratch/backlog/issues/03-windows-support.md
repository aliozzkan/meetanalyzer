Status: needs-triage

# Windows desteği

İlk hedef macOS (Apple Silicon). Windows için: whisper-cli binary'si (CPU / CUDA / Vulkan seçimi), loopback davranışı, mikrofon izni, power assertion farkları, NSIS paketleme.

## Comments

**2026-10-11 (issue 06'dan):** `electron-builder.yml` → `asarUnpack: resources/**` ve `files` her platformun paketine `resources/bin/whisper-cli` (şimdilik yalnızca macOS arm64 Mach-O) dosyasını da katar. Windows/Linux eklenirken `resources/bin` platforma göre ayrılmalı (ör. `mac.extraResources` / platform alt klasörleri) ve `getWhisperPaths` platforma duyarlı olmalı; `check:whisper` da platforma göre çalışmalı.
