Status: resolved
Blocked by: —

# whisper-cli binary'si ve VAD modeli

Spec: [../spec.md](../spec.md) → "Transcription (ADR-0004, ADR-0005)"

## Yapılacaklar

- `scripts/build-whisper.sh`: whisper.cpp'yi sabit bir release tag'inden (script içinde sabit; `--vad` desteği olan bir sürüm) klonla, `cmake -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DBUILD_SHARED_LIBS=OFF` ile derle, `whisper-cli`'yi `resources/bin/` altına koy.
- Silero VAD ggml modelini sabit bir kaynaktan indirip `resources/models/` altına koy; SHA-256'yı script'te doğrula. (~865 KB, uygulamaya gömülür.)
- `resources/bin/` ve `resources/models/` → `.gitignore`.
- `electron-builder.yml`: `asarUnpack: resources/**` zaten var; binary'nin pakette çalıştırılabilir kaldığını doğrula. Dev ve paketli build için binary/VAD yolunu çözen yardımcı fonksiyon.
- README'ye kısa "whisper binary'sini derle" adımı.

## Kabul kriterleri

- [ ] Temiz bir checkout'ta `scripts/build-whisper.sh` tek komutla binary ve VAD modelini üretir.
- [ ] `resources/bin/whisper-cli --help` çalışır; binary sistemde whisper/ggml dylib'ine bağımlı değildir (`otool -L`).
- [ ] `pnpm build:mac` ile üretilen uygulamada yol çözücü binary'yi bulur.

## Comments

**2026-10-11:** Uygulandı.
- `scripts/build-whisper.sh` (`pnpm build:whisper`): whisper.cpp `v1.9.5`'i **commit ile** sabitler (tag annotated; commit `d1be6fd…`), Metal gömülü + statik + `GGML_NATIVE=OFF` derler, `resources/bin/whisper-cli`'yi koyar ve `otool -L` / `--help` ile doğrular. VAD modeli `ggml-silero-v6.2.0.bin` (865 KB, ticket'taki ~2 MB tahmini yanlıştı), HF revision + SHA-256 ile indirilir. Temiz checkout'ta ~27 sn.
- `pnpm check:whisper` (= `build-whisper.sh --check`): derlemeden dosya ve SHA-256 doğrular; `build:mac` ve `build:unpack` bunu önce çalıştırır, böylece binary'siz paket üretilemez.
- `src/main/whisper/paths.ts` → `getWhisperPaths({ isPackaged, appPath, resourcesPath })`.
- Duman testi: `ggml-tiny` + `--vad` + gömülü Metal ile `jfk.wav` transcribe edildi. Paketli düzende (`build:unpack`, `build:mac`) gerçek yol çözücü binary'yi buldu ve çalıştırdı.
- **Açık risk (dağıtım):** Binary yalnızca electron-builder'ın geliştirme sertifikasıyla imzalı olarak denendi. Developer ID imzası + notarization (hardened runtime) altında gömülü Metal kütüphanesinin çalışma zamanı derlemesinin sorunsuz çalıştığı henüz doğrulanmadı; dağıtım hazırlığında test edilmeli.
- **Not:** `resources/**` her platformun paketine girer. Windows/Linux için ayrı binary ve platform ayrımı backlog 03'te.
