---
status: accepted
---

# Suspect Word'ler spell check ile değil, Transcription güveniyle belirlenir

Whisper'ın hataları yazım hatası değil, yanlış duyma hatasıdır: çıkan kelime çoğu zaman sözlükte geçerli bir kelimedir ama söylenen değildir. Bu yüzden klasik spell check (Hunspell/nspell, Electron'un yerleşik spell checker'ı) bu hataların çoğunu yakalamaz. Suspect Word, whisper'ın kelimeyi oluşturan token'lara verdiği olasılıklardan en düşüğü bir eşiğin altında kalan kelimedir; eşik ve gerekçesi [docs/tuning.md](../tuning.md) içindedir.

**İnceltme (issue 08, gerçek whisper çıktısına bakınca):** minimum yalnızca kelimenin **harf ya da rakam içeren** token'ları üzerinden alınır; noktalama token'ları (`,` `.` `?` …) güvene katılmaz ve yalnızca noktalamadan oluşan kelime hiçbir zaman Suspect Word olmaz. Noktalama olasılığı yanlış duymayı değil noktalama belirsizliğini gösterir: gerçek çıktıda `gelecek` 0.69 iken arkasındaki `,` 0.23'tür ve katılsaydı "gelecek," yanlışlıkla şüpheli sayılırdı. Bu, işaretlemeyi bayrak seline çevirmeden gerçek hataları ayırt eder.

## Considered Options

- **Hunspell/nspell + `dictionary-tr`**: yanlış duyulmuş ama geçerli kelimeleri kaçırır. İleride ikinci bir sinyal olarak eklenebilir.
- **Electron yerleşik spell checker**: macOS'te `setSpellCheckerLanguages` etkisizdir ve OS sözlüğü kullanılır; ayrıca serbest düzenlenebilir metin varsayar, bizde metin salt okunurdur.
- **Sunucuda LLM ile düzeltme**: ADR-0001'e aykırı (onay öncesi metin cihazdan çıkar).

## Consequences

- Token olasılıklarını veren bir transcription motoru gerekir (whisper.cpp `-ojf`).
- Whisper'ın sessizlikte yüksek güvenle uydurduğu metinler Suspect Word olarak işaretlenmez; bu yüzden VAD açık tutulur.
