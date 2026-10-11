Status: needs-triage

# İlk dilim: Mikrofondan Approved Transcript'e

Kullanıcı bir Meeting'de mikrofondan Recording alır, toplantı bitince Meeting'i kapatır, Transcription'ı elle başlatır, Suspect Word'leri dinleyerek düzeltir ve Transcript'i onaylar. Analysis Request ve backend bu dilime dahil değildir.

Terimler [GLOSSARY.md](../../GLOSSARY.md), durumlar ve geçişler [docs/meeting-lifecycle.md](../../docs/meeting-lifecycle.md), sayısal değerler [docs/tuning.md](../../docs/tuning.md) ile aynıdır. İlgili kararlar: ADR-0001 … ADR-0005.

## Kapsam

- **Platform:** yalnızca macOS, Apple Silicon.
- **Ses kaynağı:** yalnızca sistemin varsayılan mikrofonu. Recording şeması baştan "bir Recording'in birden çok kanalı olabilir" diye kurulur; bu dilimde tek kanal (`mic`) yazılır.
- **Durumlar:** `Recording → Closed → Transcribing → Transcribed → Approved`.

## Kullanıcı akışı

### 1. Onboarding ve model

- İlk açılışta "Transcription modeli (~550 MB) indirilsin mi?" sorulur; indirme yalnızca kullanıcı onaylarsa başlar.
- Atlanırsa ilk "Transcribe" basışında yeniden sorulur. Recording için model gerekmez.
- Recording sürerken hiçbir otomatik indirme başlamaz.
- İndirme: Hugging Face `ggerganov/whisper.cpp`, sabit revision; HTTP Range ile kaldığı yerden devam; bitince SHA-256 doğrulanır; öncesinde boş alan kontrolü. İlerleme çubuğu ve yeniden deneme.

### 2. Meeting başlatma ve Recording

- Meeting başlatılırken Language seçilir (Türkçe / İngilizce, varsayılan Türkçe). whisper bu dille çağrılır; otomatik dil algılama yok.
- Aynı anda en fazla bir Meeting Recording durumunda olabilir.
- İlk "Kaydı başlat"ta `systemPreferences.askForMediaAccess('microphone')`. Reddedilirse Recording başlamaz; açıklama + "Sistem Ayarları'nı aç" (`x-apple.systempreferences:` deep link) gösterilir.
- Recording sırasında ses seviyesi göstergesi; tuning'deki süre boyunca tam sessizlikte "mikrofon sessiz görünüyor" uyarısı.
- Kullanıcı bir Meeting içinde Recording'i birden çok kez başlatıp durdurabilir.

### 3. Meeting'i kapatma ve silme

- Hiç Recording'i olmayan Meeting kapatılamaz; silinir.
- Approved'dan önceki her durumda Meeting silinebilir; sesleri ve verisi tamamen kaldırılır.

### 4. Transcription

- Closed bir Meeting'de kullanıcı "Transcribe"a basar → Meeting Transcribing olur ve Transcription Queue'ya girer.
- Tek işçi, FIFO. Bekleyen Meeting UI'da "Sırada", işlenen Meeting ilerlemesiyle gösterilir.
- Başka bir Meeting'in Recording'i sürerken de Transcription devam eder.
- Transcribing sırasında "Mac'in kapağını kapatırsanız işlem duraklar" uyarısı görünür.
- Recording'ler sırayla, Recording başına bir whisper çağrısıyla işlenir; her biri bitince sonucu kalıcı olarak yazılır.
- Hata → Meeting hata mesajıyla Closed'a döner; tamamlanmış Recording'lerin sonuçları korunur, yeniden başlatmada yalnızca kalanlar işlenir.

### 5. Correction

- Transcribed Meeting'de Transcript segment segment, salt okunur gösterilir; Recording sınırları ince bir ayraçla belirtilir.
- Yalnızca Suspect Word'ler tıklanabilir. Tıklanınca:
  - kelimenin çevresindeki ses (tuning: dinleme penceresi) çalınır,
  - küçük bir input/popover açılır; Correction serbest metindir, boşluk içerebilir, boş bırakılabilir (silme), komşu kelimelere uzanmaz.
- Suspect Word dışında hiçbir metin düzenlenemez.

### 6. Approve

- Her Suspect Word'ün tek tek işaretlenmesi gerekmez. Düzeltilmemiş Suspect Word varsa "X Suspect Word düzeltilmedi, yine de onaylıyor musun?" sorulur.
- Onayda: kelimeler + Correction'lar birleştirilerek Approved Transcript tek metin olarak dondurulur, Meeting Approved olur, Meeting'in ses dosyaları silinir. Geri alınamaz.

## Teknik tasarım

### Kayıt (ADR-0003)

- Renderer: `AudioContext({ sampleRate: 16000 })` + `AudioWorklet` → mono 16-bit PCM.
- Tuning'deki parça süresiyle IPC → main → `app.getPath('userData')/recordings/<meetingId>/<recordingId>/mic.wav` dosyasına append.
- WAV header'ı Recording bitince yazılır.
- `ffmpeg` / `MediaRecorder` kullanılmaz.

### Transcription (ADR-0004, ADR-0005)

- `resources/bin/whisper-cli`, `scripts/build-whisper.sh` ile sabit whisper.cpp tag'inden `GGML_METAL_EMBED_LIBRARY=ON` ile derlenir; binary git'e girmez (`.gitignore`).
- Silero VAD modeli uygulamaya gömülür (`resources/`).
- Çağrı: `whisper-cli -m <model> -f <wav> -l <tr|en> --vad --vad-model <vad> -ojf -of <out> -t <threads>`; process başlar başlamaz `os.setPriority(pid, …)`.
- İlerleme stdout'tan okunur. İptal ve kapanışta process `kill` edilir.
- Model `userData/models/` altında durur.

### Suspect Word (ADR-0002)

- `-ojf` çıktısındaki token'lar kelimelere gruplanır; kelimenin güveni = token olasılıklarının minimumu.
- Güven tuning'deki eşiğin altındaysa `is_suspect = 1`.
- Kelime gruplama kuralı (boşlukla başlayan token yeni kelime başlatır; noktalama ve özel token'lar) implementasyonda testle sabitlenir.

### Veri (better-sqlite3)

Tablolar (taslak):

- `meetings`: id, language, state (tek alan: `recording | closed | transcribing | transcribed | approved`), last_error, created_at, closed_at, approved_at
- `recordings`: id, meeting_id, seq, started_at, ended_at, transcribed_at
- `recording_channels`: recording_id, kind (`mic`), file_path, duration_ms
- `segments`: id, recording_id, seq, start_ms, end_ms
- `words`: id, segment_id, seq, text, start_ms, end_ms, confidence, is_suspect
- `corrections`: word_id (unique), original, corrected, language, created_at
- `approved_transcripts`: meeting_id, text, created_at
- `transcription_queue`: meeting_id, enqueued_at (FIFO)

Ham whisper çıktısı (`words`) sonradan değişmez; Correction ayrı tutulur.

### Güç (powerSaveBlocker)

- Main'de küçük bir power modülü; Recording ve Transcription Queue için iki ayrı `prevent-app-suspension` blocker'ı. Her biri kendi işi bitince bırakılır.
- Doğrulama: `pmset -g assertions` → `PreventUserIdleSystemSleep`.

### Çökme ve kapanma sonrası toparlanma (açılışta)

- `recording` durumundaki Meeting'in bitmemiş Recording'i: WAV header'ı dosya boyutuna göre onarılır, `ended_at` son parçaya göre yazılır; Meeting Recording'de kalır.
- `transcribing` durumundaki Meeting'ler: Closed'a döner, kuyruktan çıkarılır; tamamlanmış Recording'lerin segment/word'leri korunur.

### Config

- Tüm tuning değerleri tek bir config modülünde; her sabit `docs/tuning.md`'ye yorumla işaret eder.

## Kabul kriterleri

- [ ] Model onboarding'de onayla indirilir, kesintiden sonra devam eder, SHA-256 uyuşmazlığında reddedilir.
- [ ] Mikrofon izni reddedildiğinde Recording başlamaz ve Sistem Ayarları yönlendirmesi görünür.
- [ ] Bir Meeting'de birden çok Recording alınabilir; seviye göstergesi ve sessiz mikrofon uyarısı çalışır.
- [ ] Recording sırasında uygulama zorla kapatılırsa açılışta WAV oynatılabilir/transcribe edilebilir durumdadır.
- [ ] Recording'i olmayan Meeting kapatılamaz; Approved öncesi her durumda silinebilir ve dosyaları kalkar.
- [ ] İki Meeting için Transcribe'a basılınca ikincisi "Sırada" görünür ve birincisi bitince başlar.
- [ ] Transcription sürerken yeni Meeting'de Recording alınabilir ve kayıtta kesinti olmaz.
- [ ] Transcription sırasında uygulama kapatılırsa açılışta Meeting Closed'dadır; yeniden başlatıldığında yalnızca kalan Recording'ler işlenir.
- [ ] Uzun sessizlik içeren kayıtta uydurma satırlar ("Altyazı M.K." vb.) çıkmaz.
- [ ] Yalnızca Suspect Word'ler tıklanabilir; tıklanınca çevresindeki ses çalar; Correction boş/çok kelimeli olabilir.
- [ ] Approve'da düzeltilmemiş Suspect Word sayısı sorulur; onay sonrası metin değişmez ve ses dosyaları silinmiştir.
- [ ] Recording ve Transcribing sırasında `pmset -g assertions` uygulamanın assertion'ını gösterir, iş bitince kalkar.
