Status: needs-triage

# Transcription modelini kendi CDN'imizden dağıt

İlk dilimde model Hugging Face'ten sabit revision + SHA-256 ile indiriliyor (bkz. docs/tuning.md). HF erişim/hız sorunlarına karşı modeli kendi CDN'imize taşı. Değişiklik yalnızca URL olmalı; revision/hash doğrulaması aynen kalır.
