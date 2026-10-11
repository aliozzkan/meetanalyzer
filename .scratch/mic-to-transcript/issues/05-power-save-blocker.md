Status: ready-for-agent
Blocked by: 03

# Uyku engeli (powerSaveBlocker) modülü

Spec: [../spec.md](../spec.md) → "Güç (powerSaveBlocker)"

## Yapılacaklar

- Main'de küçük bir power modülü: `acquire(reason)` / `release(reason)`; sebepler `recording` ve `transcription`. Her sebep kendi `prevent-app-suspension` blocker id'sini tutar; aynı sebep iki kez alınırsa tek blocker kalır.
- Recording başlayınca `recording` alınır, durunca bırakılır. (`transcription` bağlantısı issue 09'da.)

## Kabul kriterleri

- [ ] Recording sürerken `pmset -g assertions` çıktısında uygulamanın `PreventUserIdleSystemSleep` assertion'ı görünür, Recording durunca kaybolur.
- [ ] Modül için birim testi (powerSaveBlocker mock'lanarak) var.
