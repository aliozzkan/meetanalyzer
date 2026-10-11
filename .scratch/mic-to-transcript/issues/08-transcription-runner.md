Status: ready-for-agent
Blocked by: 01, 06

# Tek bir Recording'i transcribe etme ve Suspect Word üretme

Spec: [../spec.md](../spec.md) → "Transcription", "Suspect Word (ADR-0002)"

## Yapılacaklar

- Runner: bir WAV + Language alır, `whisper-cli -m <model> -f <wav> -l <tr|en> --vad --vad-model <vad> -ojf -of <tmp> -t <threads>` çalıştırır. Thread sayısı ve öncelik config'ten; spawn'dan hemen sonra `os.setPriority(pid, …)`.
- İlerlemeyi stdout/stderr'den okuyup yüzde olarak yayınla. `cancel()` process'i öldürür.
- Parser: `-ojf` JSON'unu `segments` ve `words`'e dönüştürür. Token → kelime gruplama (boşlukla başlayan token yeni kelime; özel `[_...]` token'ları atılır; noktalama önceki kelimeye eklenir). Kelime güveni = token olasılıklarının minimumu; config eşiğinin altındaysa `is_suspect = 1`.
- Sonuçlar tek transaction'da yazılır ve `recordings.transcribed_at` set edilir; hata olursa hiçbir şey yazılmaz.

## Kabul kriterleri

- [x] Gerçek bir whisper `-ojf` çıktısından alınmış Türkçe ve İngilizce fixture'larla parser testleri (ekler, noktalama, özel token'lar).
- [x] Kısa bir test WAV'ı uçtan uca transcribe edilip DB'ye yazılır.
- [x] `cancel()` sonrası DB'de yarım veri kalmaz.

## Comments

**2026-10-11 (issue 06 duman testinden):**
- Yol çözümü: `getWhisperPaths({ isPackaged, appPath, resourcesPath })` (`src/main/whisper/paths.ts`) `{ cli, vadModel }` döndürür. Binary ve VAD dosyası yoksa runner anlaşılır bir hata vermeli ("`pnpm build:whisper` çalıştır").
- `-ojf` çıktısı: `transcription[]` (segmentler: `timestamps`, `offsets` {from,to ms}, `text`, `tokens[]`). Her token: `text`, `p` (olasılık), `offsets`, `id`, `t_dtw`, `timestamps`. Özel token'lar köşeli parantezli (`[_BEG_]`, `[_TT_415]`); `[_TT_*]` zaman damgası token'ıdır ve düşük `p` taşıyabilir, kelimeye katılmamalı. Token metni boşlukla başlıyorsa yeni kelime başlar.
- **Metal ilk çalıştırma maliyeti:** gömülü Metal kütüphanesi ilk çalıştırmada derlenir (ölçüm: ~46 sn, 35 kütüphane), sonuç sistem önbelleğine yazılır ve sonraki başlatmalar ~0.3 sn. Yani kullanıcının makinesindeki ilk Transcription uzun süre ilerleme göstermeden bekleyebilir; UI'da "ilk kullanım hazırlığı" gibi bir durum gösterilmeli, süreç bu sürede hata sanılıp öldürülmemeli (timeout koyma). Önbellek temizlenirse ya da macOS güncellenirse tekrarlanabilir.
- Duman testi: `whisper-cli -m ggml-tiny.bin -f jfk.wav -l en --vad -vm resources/models/ggml-silero-v6.2.0.bin -ojf -of <çıktı> -t 4` çalıştı (exit 0, VAD zaman damgaları 0.32–10.47 sn).

**2026-10-11 (issue 07'den):** Model yolu `getModelPath(join(app.getPath('userData'), 'models'))` (`src/main/model/app-model.ts`). Model yalnızca `ModelService.getState().status === 'ready'` iken kullanılmalı (beklenen boyutta ve hash'i doğrulanmış dosya). Test için gerçek modeli HF'ten indirmek hızlı hatta ~10 sn sürüyor.

**2026-10-11:** Uygulandı. Modüller `src/main/transcription/`:
- `whisper-parser.ts`: `parseWhisperOutput(json, { vadSegments, suspectThreshold })` → `{ startMs, endMs, words[{ text, startMs, endMs, confidence, isSuspect }] }[]`; `parseWhisperStderr` (VAD segmentleri, ilerleme), `parseProgressLine`/`findProgress`, `createTimeMapper`. Kelime gruplama: boşlukla başlayan token yeni kelime, boşluksuz (ek, kesme işareti, noktalama) önceki kelimeye eklenir, `[_…]` özel token'lar atılır. Güven = harf/rakam içeren token'ların minimumu; noktalama güvene katılmaz (ADR-0002 inceltmesi); `p < eşik` Suspect Word.
- **Önemli bulgu (ADR-0006):** `--vad` açıkken token zamanları sıkıştırılmış çizgide kalır (segment zamanları çevrilir). whisper'ın stderr'indeki `vad_segment_info` satırlarından eşleme tablosu yeniden kurulur; boşluğa düşen kelime başlangıcı sonraki segmentin başına, bitişi önceki segmentin sonuna çekilir; segment zamanları kelimelerden türetilir. Whisper'ın kendi segment zamanları bile saniyelerce kayabiliyor (ilk token VAD sınırından ms önceye düşünce).
- `whisper-args.ts`: `buildWhisperArgs` (`-l <dil>` asla `auto`, `--vad`, `-ojf`, `-pp`), `whisperThreads` (performans çekirdeklerinin yarısı, en az 2), `performanceCoreCount`.
- `whisper-runner.ts`: `runWhisper` düşük öncelikle (`os.setPriority`) spawn eder, `-pp` ilerlemesini yayınlar, iptalde SIGTERM (2 sn sonra SIGKILL) ve `cancelled`, eksik binary/VAD için "pnpm build:whisper çalıştır", geçici çıktı klasörünü her durumda siler.
- `transcribe-recording.ts`: `transcribeRecording(...)` segment ve kelimeleri tek transaction'da yazar ve `recordings.transcribed_at`'i set eder; çalıştırıcı hatası, iptal, bozuk çıktı, silinen Recording ve yazma hatasında hiçbir şey yazılmaz. Hata kodları `src/main/transcription/errors.ts`.
- Fixture'lar (gerçek whisper çıktısı): `fixtures/` (`tr-gap`, `en-gap` large-v3-turbo; `tr-tiny` düşük güvenli çıktı), bkz. `fixtures/README.md`.
- **Gerçek ortamda doğrulandı** (gerçek `whisper-cli` + large-v3-turbo + gerçek DB): Türkçe ve İngilizce kayıtlar ~0.8 sn'de transcribe edilip yazıldı; kelime zamanları orijinal çizgide (Türkçe 4.00 / 11.63 sn, İngilizce 5.01 / 12.93 sn; gerçek 4.0 / 11.61 ve 5.0 / 12.94). 6 dakikalık ses %75'te iptal edildi: iptal 9 ms'de, DB'de hiçbir satır yok, geçici klasör ve süreç kalmadı. Hız ~45x gerçek zaman (Apple Silicon, Metal, 5 thread).
- Testler: 21 parser, 8 bayrak/thread, 8 çalıştırıcı (sahte whisper betiğiyle), 8 orkestrasyon; ~40 mutasyon yakalandı.
- **Bilinen sınırlar:** (1) Sentezlenmiş sesle large-v3-turbo neredeyse hiç düşük güvenli kelime üretmedi (0 şüpheli); `SUSPECT_WORD_THRESHOLD = 0.5`'in gerçek insan konuşmasında nasıl davrandığı issue 13'te ölçülecek. (2) Segment başında bazı kelimeler sıfır uzunluklu geliyor (`Ayşe` 11630–11630): whisper'ın token zamanı; oynatma ±2 sn pencere kullandığı için sorun değil. (3) Birden çok Recording'in sıralı işlenmesi ve durum geçişleri issue 09'un işi; `transcribeRecording` yalnızca tek Recording'i yazar. (4) Kullanıcının makinesindeki ilk çalıştırmada Metal derlemesi ~46 sn sürebilir (issue 06 notu); `runWhisper`'da zaman aşımı yok.

**2026-10-11 (code-review sonrası):** Düzeltilenler: ses içermeyen (yalnızca header'lı) Recording whisper çalıştırılmadan sıfır segmentle tamamlanır (gerçek whisper 0 örnekli WAV'ı "failed to read audio", çıkış 11 ile reddediyor; sessizlik, çok kısa ve uğultu seslerinde ise 0 segmentle başarılı çıkıyor, bunlar gerçek whisper'la denendi); henüz bitmemiş (`ended_at` boş) Recording için `recording-not-finished`; dışarı çıkan DB yolu `audio-missing` (ham hata sızmaz); çalıştırıcı iptal sinyalini yok sayıp dönse bile iptal edilmişse yazılmaz; yalnızca boşluktan oluşan token boş kelime üretmez; `--vad-samples-overlap 0.1` whisper'a açıkça verilir (`WHISPER_VAD_SAMPLES_OVERLAP_S`, parser aynı sabiti kullanır); `WHISPER_NICE` / `WHISPER_MIN_THREADS` / örtüşme config'te; ölü `WHISPER_VAD_ENABLED` kaldırıldı; `performanceCoreCount` yedeği çekirdekleri iki kez yarılıyordu, düzeltildi ve `cpu.ts`'e taşındı; `parseWhisperStderr` → `parseVadSegments`, kullanılmayan ikinci ilerleme ayrıştırıcıları kaldırıldı.
- Reddedilen öneri: "örtüşme bölgesini boşluktan çıkar". Gerçek `tr-tiny` verisinde sonraki cümlenin ilk kelimesi örtüşmeye (150 ms erken) damgalanıyor ve sonraki segmentin başına çekilince doğru zamana (11.59 sn) iniyor; aksi halde 8.13 sn'ye (saniyelerce yanlış) giderdi (ADR-0006'ya yazıldı).
- Bilinen sınırlar: `[BLANK_AUDIO]`, `(müzik)` gibi köşeli ya da parantezli dekoratif metinler filtrelenmiyor (VAD açıkken nadir); başında boşluk olan noktalama (` -`) ayrı bir kelime olarak kalır (şüpheli sayılmaz); `already-transcribed` yeniden transcribe etmeye (ör. model değişince) yol bırakmaz, bu karar ileride gerekirse ayrı ele alınmalı.
