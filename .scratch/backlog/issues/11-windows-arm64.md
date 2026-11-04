Status: needs-triage

# Windows on ARM (arm64)

Windows desteği yalnızca x64 hedefliyor. Snapdragon X gibi arm64 Windows makinelerde x64 uygulama emülasyonla çalışabilir, ama whisper emülasyonda yavaşlar. Yerel arm64 için `resources/bin/win32-arm64/` altında ayrı bir whisper derlemesi (CPU varyantları ve Vulkan sürücüsü desteği ayrıca ölçülmeli), electron-builder'da arm64 hedefi ve bir arm64 makinede duman testi gerekir.

Bağlam: [../../windows-support/spec.md](../../windows-support/spec.md), [ADR-0009](../../../docs/adr/0009-windows-whisper-vulkan-and-dynamic-cpu-backends.md)
