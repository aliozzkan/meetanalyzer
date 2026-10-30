Status: needs-triage

# Sistem sesi: toplantıdaki diğer katılımcıları da kaydet

Recording bugün yalnızca kullanıcının mikrofonunu kaydediyor; toplantıdaki diğer katılımcılar, kulaklık takılı değilse hoparlörden mikrofona sızan kısık ve yankılı sesten ibaret. Bu dilimle her Recording mikrofonu ve bilgisayarın sistem sesini ayrı kanallar olarak birlikte kaydeder, iki kanal ayrı ayrı transcribe edilir ve Transcript'in her bölümü bir **Side**'a (Self / Others) ait olur. Kulaklıksız toplantıda mikrofona giren yankı Transcript seviyesinde tekilleştirilerek atılır.

Terimler [GLOSSARY.md](../../GLOSSARY.md), durumlar [docs/meeting-lifecycle.md](../../docs/meeting-lifecycle.md), sayısal değerler [docs/tuning.md](../../docs/tuning.md) ile aynıdır. Spec ile birlikte GLOSSARY'de **Recording**, **Transcript**, **Approved Transcript** güncellendi; **Side**, **Self**, **Others** eklendi. İlgili kararlar: ADR-0003, ADR-0005, ADR-0007. Kaynak not: [backlog 02](../backlog/issues/02-system-audio.md).

## Mevcut durum

- Electron `^39.2.6` (kurulu 39.8.10), artık destek dışı. Mikrofon `getUserMedia` ile, tarayıcı ses işlemesi kapalı (`echoCancellation: false`) açılıyor (`mic-capture.ts`).
- `recording_channels.kind` yalnızca `'mic'` kabul ediyor; `segments` kanala değil Recording'e bağlı; `recordings.transcribed_at` Recording başına.
- Transcription, kuyruk, kelime dinletme ve onay `kind = 'mic'` varsayıyor (`transcribe-recording.ts`, `transcription-queue.ts`, `word-audio.ts`, `approval-service.ts`).
- İzin handler'ı (`index.ts`) video içeren her medya isteğini reddediyor; `setDisplayMediaRequestHandler` yok.
- `electron-builder.yml` yalnızca `NSMicrophoneUsageDescription` ekliyor; minimum macOS tanımlı değil.

## Kapsam

- **Platform:** yalnızca macOS 14.2+, Apple Silicon. Windows [ayrı dilimde](../windows-support/spec.md) (issue 07 ve 08); ses kaynakları bunun için adapter arkasında.
- **Electron 45'e geçiş** bu dilimin içinde yapılır.
- **Ne kaydedilir:** varsayılan çıkış cihazındaki tüm sistem sesi (toplantı uygulaması, bildirimler, müzik). Yalnızca toplantı uygulamasını seçmek kapsam dışı. Uygulamanın kendi sesi (Suspect Word dinletme) kayda girmez.

## Kapsam dışı

- Ses seviyesinde yankı giderme (WebRTC AEC3): tekilleştirme yetmezse ileride (ADR-0007).
- Yalnızca belirli bir uygulamanın sesini yakalama (native helper, ör. AudioTee).
- Kişi bazında konuşmacı ayrımı (diarization); Others birden çok kişiyi kapsar.
- macOS 14.2 öncesi (ScreenCaptureKit yolu ve ekran kaydı izni).
- Sistem sesini Recording bazında açıp kapatma ayarı.

## Kullanıcı akışı

### 1. Bilgilendirme ve izinler

- İlk "Kaydı başlat"tan önce bir kerelik bilgilendirme: uygulama toplantıdaki diğer katılımcıların sesini de kaydeder; katılımcıları bilgilendirmek kullanıcının sorumluluğundadır; ses yalnızca cihazda kalır, onayda silinir, analiz için yalnızca metin gönderilir. Kabul edilmeden Recording başlamaz; kabul ayarlarda saklanır.
- Her "Kaydı başlat"ta önce mikrofon izni (`askForMediaAccess('microphone')`), ardından sistem sesi akışı açılır. İlk seferde macOS kendi "System Audio Recording" istemini gösterir.
- Sistem sesi izni önceden sorgulanamaz: izin yoksa akış hata vermeden açılır ama ses track'i `ended` gelir. Bu durumda açılan her şey kapatılır, boş Recording silinir, Recording başlamaz ve açıklama + "Sistem Ayarları'nı aç" (Gizlilik › Ses Kaydı) gösterilir.
- **İki izinden biri yoksa Recording başlamaz.** Yalnızca mikrofonla kayıt yoktur.

### 2. Recording

- Her Recording iki kanal yazar: `mic` (Self) ve `system` (Others), aynı başlangıç anıyla, ayrı dosyalara.
- İki seviye göstergesi: "Sen" ve "Toplantı". Sessiz mikrofon uyarısı yalnızca `mic` için; sistem sesinin sessizliği normaldir (herkes susuyor, toplantı başlamadı).
- **Kayıt sürerken bir kanal koparsa** (AirPods'a geçiş, çıkış cihazı değişimi, izin geri alındı, mikrofon çıkarıldı): Recording kendiliğinden durur, o ana kadarki kısım korunur, kullanıcıya nedeni ("Sistem sesi kesildi" / "Mikrofon kesildi") ve tek tıkla yeni Recording başlatan düğme gösterilir.
- **Recording bitince**, mikrofonda konuşma olduğu halde sistem kanalı baştan sona sessizse: "Toplantı sesi duyulmadı. Toplantı uygulamanın çıkışı Mac'in varsayılan çıkışıyla aynı mı?" uyarısı. (Sistem sesi yalnızca varsayılan çıkış cihazından yakalanır; toplantı uygulaması başka bir cihaza çalıyorsa kanal sessiz kalır ve akış kopmaz.)

### 3. Transcription

- Her Recording'in her kanalı ayrı bir whisper çağrısıyla işlenir; ilerleme ve kalıcı yazım kanal başınadır. Hata sonrası yeniden başlatmada yalnızca kalan kanallar işlenir.
- Bu dilimden önce alınmış, yalnızca `mic` kanalı olan Recording'ler tek kanallı olarak işlenmeye devam eder; Side'ları Self'tir.

### 4. Transcript ve yankı (ADR-0007)

- İki kanalın segmentleri başlangıç zamanına göre tek Transcript'te birleşir; ardışık aynı Side'lı segmentler bir blok olur.
- Bir `mic` kelimesi tuning'deki pencere içinde aynı (normalize) yazılışla `system` kanalında da geçiyorsa yankı sayılır ve Transcript'e girmez. Ham whisper çıktısı (`words`) değişmez; atılan kelimeler yalnızca Transcript'ten çıkar.
- Atılan kelimeler Correction ekranında görünmez, geri getirilemez ve "X Suspect Word düzeltilmedi" sayısına girmez.

### 5. Correction ve Approve

- Transcript Side etiketli bloklar halinde ("Sen" / "Diğerleri") gösterilir; Recording ayraçları kalır.
- Suspect Word tıklanınca yalnızca kelimenin kendi kanalının sesi çalınır.
- Approved Transcript Side bilgisini korur: sıralı (Side, metin) blokları olarak dondurulur; düz metin görünümü "Sen: …" / "Diğerleri: …" bloklarıdır.
- Onayda iki kanalın ses dosyası da silinir.

## Teknik tasarım

### Electron 45

- `electron` 45'e, birlikte `electron-vite` / `@electron-toolkit/*` / `electron-builder` uyumlu sürümlere; `better-sqlite3` native rebuild; whisper sidecar ve mevcut testler doğrulanır.
- `electron-builder.yml`: `mac.minimumSystemVersion: '14.2'`; `extendInfo`'ya `NSAudioCaptureUsageDescription` (Türkçe/İngilizce).

### Ses kaynakları (adapter)

- Renderer'da `AudioSource` arayüzü: `start`, `stop` (kalanı flush ederek), `onChunk` (her zaman `AUDIO_FORMAT`: 16 kHz mono 16-bit PCM), `onLevel`, `onEnded` (kaynak beklenmedik şekilde kesildi).
- `MicSource`: bugünkü `mic-capture.ts`.
- `MacLoopbackSource`: `getDisplayMedia` + main'de `session.setDisplayMediaRequestHandler` → `callback({ audio: 'loopback' })` (Electron 39+ macOS 14.2'de CoreAudio Tap kullanır, flag gerekmez). 48 kHz stereo → 16 kHz mono dönüşümü adapter'ın içinde. Kendi sesimiz `restrictOwnAudio` ile hariç tutulur. Track `ended` → izin yok (açılışta) ya da kopma (`onEnded`).
- Kaydın geri kalanı (IPC, WAV, kurtarma, transcription) platformdan ve kaynaktan habersizdir; ileride Windows WASAPI ya da native helper yalnızca yeni bir adapter'dır.
- İzin handler'ı yalnızca bu loopback isteğine izin verecek şekilde daraltılır; kamera hâlâ reddedilir.

### Veri

- `recording_channels.kind`: `'mic' | 'system'`; kanal başına `transcribed_at`.
- `segments`: hangi kanaldan geldiği (`channel`); Side kanaldan türetilir (`mic` → Self, `system` → Others).
- Dosyalar: `recordings/<meetingId>/<recordingId>/mic.wav` ve `system.wav`.
- `approved_transcripts`: Side blokları saklanır (biçim issue 08'de testle sabitlenir).

### Çökme sonrası toparlanma

- İki dosya ayrı ayrı onarılır; Recording'in `ended_at`'i kısa olan kanala göre belirlenir. Kanallardan biri boşsa Recording bütün olarak silinir (issue 04 notu). `docs/meeting-lifecycle.md`'deki "Çökme" maddesi buna göre güncellenir.

## Doğrulanmamış varsayımlar (issue 01 ölçer)

- `getDisplayMedia` video istemeden yalnızca ses verebiliyor mu, yoksa video track hemen durdurulmalı mı.
- Hardened runtime altında tap için ek entitlement gerekiyor mu.
- `restrictOwnAudio` Electron 45'te var mı, Suspect Word dinletmesini kayıttan dışlıyor mu.
- Varsayılan çıkış cihazı değişince (AirPods) akış `ended` mı oluyor, sessizleşiyor mu.
- Toplantı uygulaması varsayılan olmayan cihaza çalarken sistem kanalı gerçekten sessiz mi.
- Sequoia/Tahoe'nun aylık izin yenileme istemi bu izinde de çıkıyor mu.
- Yankı tekilleştirmesi gerçek kulaklıksız bir toplantıda ne kadar yankı bırakıyor, ne kadar gerçek söz siliyor.

Sonuçlar bu bölüme not olarak geri yazılır; tasarımı değiştiren bir sonuç varsa ilgili issue'lar güncellenir.

## Kabul kriterleri

- [ ] Uygulama Electron 45'te çalışır; mevcut testler ve Transcription duman testi geçer.
- [ ] İlk Recording'den önce bilgilendirme kabul edilmeden kayıt başlamaz.
- [ ] Sistem sesi izni reddedilmişse Recording başlamaz, boş Recording kalmaz ve Sistem Ayarları yönlendirmesi görünür.
- [ ] Bir Recording `mic.wav` ve `system.wav` yazar; ikisi de 16 kHz mono ve aynı anda başlar.
- [ ] Recording sürerken çıkış cihazı değişirse ya da kanallardan biri koparsa Recording durur ve kullanıcı nedenini görür.
- [ ] Mikrofonda konuşma varken sistem kanalı baştan sona sessizse Recording sonunda uyarı görünür.
- [ ] Recording sırasında Suspect Word dinletilirse o ses `system.wav`'a girmez.
- [ ] Kulaklıksız bir toplantıda diğer katılımcıların cümleleri Transcript'te bir kez ve Others olarak görünür.
- [ ] Correction ekranında bloklar "Sen" / "Diğerleri" olarak etiketlidir; Suspect Word kendi kanalından çalar.
- [ ] Approved Transcript Side bloklarını içerir; onaydan sonra iki ses dosyası da silinmiştir.
- [ ] Recording sırasında çökmeden sonra iki kanal da onarılır; kanallardan biri boşsa Recording silinir.
- [ ] Yalnızca `mic` kanalı olan eski Recording'ler transcribe olur ve Self olarak görünür.
