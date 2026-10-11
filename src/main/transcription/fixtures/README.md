# whisper-cli fixture'ları

`whisper-parser.test.ts` bu dosyalarla çalışır. Hepsi **gerçek `whisper-cli` çıktısıdır** (whisper.cpp v1.9.5,
`pnpm build:whisper` ile derlenen binary), runner'ın kullandığı komutla alınmıştır:

```
whisper-cli -m <model> -f <wav> -l <tr|en> --vad --vad-model ggml-silero-v6.2.0.bin -ojf -of <çıktı> -t 4 -pp
```

Sesler macOS `say` ile sentezlenip (`Yelda` Türkçe, `Samantha` İngilizce) `afconvert -d LEI16@16000 -c 1` ile
16 kHz mono WAV'a çevrilmiş ve başa, ortaya ve sona sessizlik eklenmiştir (VAD zaman eşlemesini sınamak için).

| Dosya       | Model               | Ses                                                                                                                                                                                      |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tr-gap.*`  | large-v3-turbo q5_0 | 4 sn sessizlik, "Ankara'daki toplantıya yarın saat on dörtte başlayacağız.", 3.5 sn sessizlik, "Ayşe Hanım ve Çağlar Bey geliştirme ekibinden gelecek, değil mi?", 2 sn sessizlik        |
| `en-gap.*`  | large-v3-turbo q5_0 | 5 sn sessizlik, "The quarterly budget review is scheduled for Tuesday, March 12th.", 4 sn sessizlik, "Please send the final report to Jonathan Weatherby before noon.", 1.5 sn sessizlik |
| `tr-tiny.*` | tiny                | `tr-gap` ile aynı ses; küçük model çok sayıda düşük güvenli kelime üretir (Suspect Word testleri için)                                                                                   |

`*.json`: `-ojf` çıktısı. `*.stderr.txt`: stderr (VAD segment bilgisi ve ilerleme satırlarını içerir). Makineye özel
yollar `/models/…`, `/audio/…`, `/vad/…` olarak değiştirilmiştir.

Önemli bulgu: VAD açıkken segment zamanları orijinal zaman çizgisine çevrilir, **token zamanları çevrilmez**
(sessizlikleri çıkarılmış ses üzerinde kalır). Parser, stderr'deki `vad_segment_info` satırlarından whisper.cpp'nin
eşleme tablosunu yeniden kurar.
