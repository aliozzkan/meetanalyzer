# Meetanalyzing

Katıldığın online toplantıları dinleyip verimliliğini analiz eden masaüstü uygulaması (Electron + React + TypeScript).

## Geliştirme

```bash
pnpm install
pnpm build:whisper   # whisper-cli ve VAD modelini hazırlar (bir kez)
pnpm dev
```

### whisper binary'sini derle

Transcription, uygulamaya gömülü bir `whisper-cli` binary'si ile yapılır ([ADR-0004](docs/adr/0004-whisper-as-sidecar-binary.md)). Binary ve Silero VAD modeli git'e girmez; `pnpm build:whisper` bunları üretip `resources/bin/` ve `resources/models/` altına koyar. Script sabit sürümlerle (whisper.cpp tag'i, VAD modeli revision ve SHA-256) çalışır; kaynak `.cache/whisper.cpp` altına klonlanır. Gereksinimler: macOS (Apple Silicon), Xcode komut satırı araçları (`git`, `curl` dahil), `cmake` (`brew install cmake`). `pnpm check:whisper` dosyaların hazır olup olmadığını derlemeden kontrol eder; `build:mac` ve `build:unpack` paketlemeden önce bunu çalıştırır, dosyalar yoksa durur. `resources/` altındaki dosyalar olmadan Transcription çalışmaz; Recording etkilenmez.

## Build

```bash
pnpm build:mac    # veya build:win, build:linux
```
