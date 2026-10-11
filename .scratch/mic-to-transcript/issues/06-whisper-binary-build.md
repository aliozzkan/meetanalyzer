Status: ready-for-agent
Blocked by: —

# whisper-cli binary'si ve VAD modeli

Spec: [../spec.md](../spec.md) → "Transcription (ADR-0004, ADR-0005)"

## Yapılacaklar

- `scripts/build-whisper.sh`: whisper.cpp'yi sabit bir release tag'inden (script içinde sabit; `--vad` desteği olan bir sürüm) klonla, `cmake -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DBUILD_SHARED_LIBS=OFF` ile derle, `whisper-cli`'yi `resources/bin/` altına koy.
- Silero VAD ggml modelini sabit bir kaynaktan indirip `resources/models/` altına koy; SHA-256'yı script'te doğrula. (~2 MB, uygulamaya gömülür.)
- `resources/bin/` ve `resources/models/` → `.gitignore`.
- `electron-builder.yml`: `asarUnpack: resources/**` zaten var; binary'nin pakette çalıştırılabilir kaldığını doğrula. Dev ve paketli build için binary/VAD yolunu çözen yardımcı fonksiyon.
- README'ye kısa "whisper binary'sini derle" adımı.

## Kabul kriterleri

- [ ] Temiz bir checkout'ta `scripts/build-whisper.sh` tek komutla binary ve VAD modelini üretir.
- [ ] `resources/bin/whisper-cli --help` çalışır; binary sistemde whisper/ggml dylib'ine bağımlı değildir (`otool -L`).
- [ ] `pnpm build:mac` ile üretilen uygulamada yol çözücü binary'yi bulur.
