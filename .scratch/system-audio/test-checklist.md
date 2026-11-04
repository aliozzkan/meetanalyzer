# Sistem sesi: yapılacak test listesi

Geliştirme sırasında test çalıştırılmadı (karar); otomatik testler geliştirme bitince birlikte çalıştırıldı: **46 dosya, 357 test geçti**, `pnpm typecheck` ve `src` lint temiz. Kalan: **[elle]** maddeler (gerçek cihaz/izin gerektirir).

Gösterim: **[otomatik]** vitest/typecheck ile çalıştırılır; **[elle]** gerçek cihaz/uygulamada denenir.

## Ön koşullar

- [x] **[otomatik]** `pnpm typecheck`, `pnpm test` (mevcut + yeni testler) ve `pnpm lint` (yalnızca `src/`) temiz.
- [x] **[elle]** Issue 01 ölçümleri (`prototypes/system-audio-loopback`) yapıldı ve issue 01 tablosuna + spec'in "Doğrulanmamış varsayımlar" bölümüne yazıldı: video:false ile yalnızca ses ✓, izin reddi (`readyState: 'ended'`, olay yok) ✓, hardened runtime ek entitlement gerekmedi ✓, `restrictOwnAudio` çalışıyor ✓, AirPods/çıkış değişimi akışı kesmiyor ✓, çıkış cihazından bağımsız yakalama ✓, ses işleme kapalı kısıtları ✓, deep link ✓. **Kalan:** aylık izin yenileme istemi (ancak bir ay sonra izlenebilir), Developer ID imzalı/notarized pakette entitlement doğrulaması.
- [ ] **[elle]** Transcription duman testi (Electron 45 + whisper-cli + model).
- [ ] **[elle]** Kulaklıklı ve kulaklıksız örnek kayıtlar alınmış (issue 07 için).

## 02 — `AudioSource` adapter'ı

Kod tamam (renderer: `audio-source.ts`, `pcm-pipeline.ts`, `mic-source.ts`, `open-stream.ts`, `recorder-controller.ts`; preload `append` kanal alır).

- [x] **[otomatik]** `recorder-controller.test.ts` sahte `AudioSource` ile geçer: mevcut senaryolar + yeni "kaynak kesilirse Recording kendiliğinden biter" ve "stop sonrası onEnded yok sayılır; yeni Recording kopma işaretini temizler".
- [ ] **[elle]** Mikrofon kaydı bugünkü gibi: başlat → konuş → seviye göstergesi oynar → durdur → WAV oluşur, transcribe edilir (regresyon).
- [ ] **[elle]** Sessiz mikrofon uyarısı hâlâ 10 sn sessizlikten sonra çıkar, ses gelince kalkar.
- [ ] **[elle]** Kayıt sırasında mikrofonu çıkar/izni kapat: Recording kendiliğinden durur, kaydedilen kısım korunur (arayüz mesajı 05'te).
- [ ] **[elle]** Kulaklıkla (AirPods) kayıt başlatma: ses grafiği takılmıyor, parçalar geliyor (kulaklık sorunu araştırması; `pcm-pipeline.ts` hâlâ `context.destination`'a bağlı).

## 03 — `MacLoopbackSource` ve izin

Kod tamam (main: `recordings/system-audio.ts` + izin handler daraltma + `openSystemAudioSettings` IPC; renderer: `mac-loopback-source.ts`, `AudioPermissionError`, controller `systemAudioDeniedFor`, izin yok uyarısı). Kaynak, `use-recorder`'a issue 04'te bağlanır (main kanal yazmadan bağlamak mic.wav'ı bozardı).

- [x] **[otomatik]** `system-audio.test.ts`: video içeren medya isteği reddedilir, `display-capture` ve yalnızca ses medyası kabul edilir, diğer izinler reddedilir.
- [x] **[otomatik]** `recorder-controller.test.ts` "mikrofon + sistem sesi" grubu: açılış sırası (mic → system), parçalar kanalıyla gönderilir, sistem sesi izni yoksa mikrofon kapanır + Recording silinir + `systemAudioDeniedFor`, tüm kaynaklar açılmadan gelen parçalar atılır, sistem sesi kopması `interrupted.channel = 'system'`.
- [ ] **[elle]** 48 kHz stereo → 16 kHz mono dönüşümü (birim testi yazılamadı: dönüşüm tarayıcının `AudioContext({ sampleRate: 16000 })`'ında): prototipten/uygulamadan alınan `system.wav` 16 kHz mono; Safari'de çalan video duyuluyor, hız/ton doğru (hızlanma ya da yavaşlama yok), stereo sesler kayıpsız tek kanala iniyor.
- [ ] **[elle]** Sistem sesi izni verilmişken kaynak parçalar ve seviye üretir (Safari videosu açıkken seviye hareket eder).
- [ ] **[elle]** İzin reddedilmişken ("Ses Kaydı" kapalı): Recording başlamaz, boş Recording kalmaz, "Sistem sesi izni verilmedi" uyarısı + "Sistem Ayarları'nı aç" görünür; düğme "Ekran ve Sistem Ses Kaydı" sayfasını açar (deep link `Privacy_AudioCapture`; yanlış sayfa açarsa `Privacy_ScreenCapture`'a geçilir).
- [ ] **[elle]** `getDisplayMedia({ audio, video: false })` Electron 45'te çalışıyor mu; çalışmazsa kaynak `video: true` + video track'i kapatma yoluna düşüyor ve ekran kaydı izni **istenmiyor** (issue 01 ölçümü).
- [ ] **[elle]** Kayıt sırasında Suspect Word dinlet (transcript ekranı başka Meeting'de): çalınan ses `system.wav`'a girmiyor (`restrictOwnAudio`; girerse `loopbackWithMute` ya da dinletmeyi kayıt sırasında kapatma seçeneği değerlendirilir).
- [ ] **[elle]** Kamera isteği hâlâ reddediliyor (DevTools: `navigator.mediaDevices.getUserMedia({video:true})` → NotAllowedError).

## 04 — İki kanallı Recording ve kurtarma

Kod tamam (migration 5: `recording_channels` yeniden kuruldu, `kind IN ('mic','system')` + kanal başına `transcribed_at`; `recording-service` iki dosya/iki kanal satırı, `append(id, pcm, channel)`; `recovery.ts` Recording bazında; `use-recorder` artık mic + system kaynaklarını bağlar).

- [x] **[otomatik]** Yeni testler geçer: `recording-service.channels.test.ts`, `recovery.channels.test.ts`, `db/migration-channels.test.ts`, `recordings/two-channel-cleanup.test.ts` (Onay ve Meeting silme iki dosyayı kaldırır).
- [x] **[otomatik]** **Mevcut testlerden kırılanlar** düzeltilir: `recording-service.test.ts` / `recording-service.close-failure.test.ts` (artık iki dosya, iki kanal satırı, iki fd), `recovery.test.ts` (tek kanallı eski Recording'ler hâlâ onarılır), `database.test.ts` (şema/kullanıcı sürümü), transcribe/queue/word-audio testleri `kind = 'mic'` varsayımı yüzünden.
- [ ] **[elle]** Bir Recording `mic.wav` ve `system.wav` yazar; ikisi de 16 kHz mono; başlangıçları aynı anda (iki dosyayı aynı konuşmayı/tıklamayı gösteren bir sesle karşılaştır: kayma < ~0,5 sn).
- [ ] **[elle]** Kaynaklardan biri açılamazsa (sistem sesi izni kapalı) Recording oluşmaz: Meeting'de Recording satırı ve dosya klasörü kalmaz.
- [ ] **[elle]** Kayıt sırasında çıkış cihazı değişirse (AirPods tak/çıkar) Recording **durmaz** ve sistem kanalı kesintisiz sürer (issue 01 ölçümü). Mikrofon çıkarılır ya da izin geri alınırsa Recording durur, kaydedilen kısım korunur (iki dosya geçerli WAV). AirPods takılınca mikrofon kanalının davranışı (varsayılan giriş değişiyor) uygulamada ölçülür.
- [ ] **[elle]** Zorla kapatma (Activity Monitor → Force Quit) sonrası uygulamayı aç: iki dosya onarılır, Recording görünür; kanallardan biri boşsa Recording silinir.
- [ ] **[elle]** Uygulama ilk kez migration'la açılıyorsa (eski veritabanı kopyasıyla): mevcut Meeting'ler, Transcript'ler ve Approved Transcript'ler olduğu gibi açılır.

## 05 — Recording arayüzü

Kod tamam (main: `settings` sistem sesi bilgilendirmesi + `recording-service` kapısı `system-audio-consent-required`; shared: `meeting-silence.ts`; renderer: controller `systemLevel` / `consentRequiredFor` / `quietMeetingFor` / `interrupted`, `recording-controls.tsx` uyarıları ve iki gösterge).

- [x] **[otomatik]** `shared/meeting-silence.test.ts` (sessiz toplantı kararı), `settings-service.consent.test.ts`, `recording-service.channels.test.ts` "bilgilendirme" grubu, `recorder-controller.test.ts` (consent, quiet meeting, kopma sonrası uyarı yok).
- [ ] **[elle]** Temiz kurulumda (ayarlar sıfır) ilk "Kaydı başlat": bilgilendirme metni çıkar (diğer katılımcıların sesi, sorumluluk, ses cihazda kalır/onayda silinir/yalnızca metin gider). "Anladım, kaydı başlat" tıklanınca kayıt başlar; uygulamayı yeniden aç, ikinci Recording'de bir daha sorulmaz.
- [ ] **[elle]** Bilgilendirme kabul edilmeden Recording hiç başlamaz (satır/klasör oluşmaz).
- [ ] **[elle]** Kayıt sırasında "Sen" ve "Toplantı" göstergeleri ayrı ayrı hareket eder (yalnızca konuş → Sen; yalnızca Safari videosu → Toplantı).
- [ ] **[elle]** Sessiz mikrofon uyarısı yalnızca mikrofon sessizken çıkar; sistem sesi sessizken (kimse çalmıyor) uyarı çıkmaz.
- [ ] **[elle]** Kayıt sırasında çıkış cihazını değiştir (AirPods tak/çıkar) → **uyarı çıkmaz**, kayıt sürer (ölçüm: akış kesilmiyor). Mikrofonu çıkar / AirPods mikrofonuna geçiş sırasında mikrofon kesilirse "Mikrofon kesildi" + "Yeni Recording başlat"; tıklayınca yeni Recording başlar, eski kısım korunmuştur.
- [ ] **[elle]** Sistem sesi iznini kayıt sırasında geri al (Ayarlar › Gizlilik ve Güvenlik › Ekran ve Sistem Ses Kaydı › Yalnızca Sistem Ses Kaydı) → "Sistem sesi kesildi" uyarısı (ya da kesilme olmuyorsa not düş).
- [ ] **[elle]** Yalnızca sen konuşup Safari'de ses çalmadan Recording'i durdur → "Toplantı sesi duyulmadı" uyarısı (metin artık çıkış cihazından söz etmez: diğer katılımcılar konuşmuyor / toplantı sesi çalmıyor / izin). Safari videosu çalarken durdur → uyarı çıkmaz. Hiç konuşmadan durdur → uyarı çıkmaz.
- [ ] **[elle]** Recording pill'i (header) hâlâ yalnızca süre gösteriyor; iki gösterge Meeting detayında (pill'e seviye eklenmedi).

## 06 — Kanal başına Transcription

Kod tamam (migration 6: `segments.channel`; `transcribeRecording` kanal başına, her kanal kendi transaction'ında + kanal `transcribed_at`, tüm kanallar bitince `recordings.transcribed_at`; kuyruk ağırlığı kalan kanalların toplam süresi; `word-audio` kelimenin kendi kanalını okur).

- [x] **[otomatik]** `transcribe-recording.channels.test.ts`: iki kanal → iki whisper çağrısı ve kanallı segmentler; Recording tüm kanallar bitince işlenmiş sayılır + ilerleme bölünür; ikinci kanalda hata → birinci korunur, yeniden başlatmada yalnızca kalan kanal; tek kanallı eski Recording; boş kanal whisper'sız; işaret tamamlama.
- [x] **[otomatik]** `word-audio.channels.test.ts`: Suspect Word dinletmesi kendi kanalını çalar.
- [x] **[otomatik]** Mevcut `transcribe-recording.test.ts`, `transcription-queue.test.ts`, `word-audio.test.ts` hâlâ geçer (tek kanallı davranış değişmedi; kırılan olursa kanal sütunlarına göre güncelle).
- [ ] **[elle]** Gerçek iki kanallı kayıt (mic + system) Transcribe edilir: iki whisper çalışması (Activity Monitor'de iki ardışık `whisper-cli`), ilerleme çubuğu kanal sayısına göre tek akışta ilerler, bittiğinde Meeting Transcribed.
- [ ] **[elle]** Transcription'ı ikinci kanalda iken uygulamayı kapat → aç: Meeting Closed'a döner; yeniden başlatınca yalnızca kalan kanal işlenir (log/Activity Monitor'den tek whisper), önceki kanalın Transcript'i kaybolmaz.
- [ ] **[elle]** Bu özellikten önce alınmış tek kanallı bir Meeting (ya da eski veritabanı) hâlâ Transcribe edilir ve kelimeler Self olarak görünür.
- [ ] **[elle]** Whisper'ın iki kanalı ardışık çalıştırması süre maliyeti: 1 saatlik iki kanallı toplantı için toplam Transcription süresi kabul edilebilir mi (ölçüm notu; gerekirse kanallar paralel/ince ayar).

## 07 — Yankı tekilleştirme ve Side'lı Transcript

Kod tamam (`transcript/echo.ts` saf fonksiyon + `ECHO_WINDOW_MS`; `transcript-service.get` iki kanalı zamana göre birleştirir, yankı kelimeleri ve boşalan segmentler çıkar; paylaşılan `Side`, `groupIntoBlocks`).

- [x] **[otomatik]** `transcript/echo.test.ts`: normalize, pencere sınırı (tam sınır dahil, 1 ms dışarısı değil), normalize eşleşme, aynı anda konuşma (Self'in farklı sözü korunur), bire bir eşleşme, en yakın aday, noktalama-only, boş system kanalı.
- [x] **[otomatik]** `transcript/transcript-service.sides.test.ts`: zamana göre birleşme + Side, ardışık aynı Side blok, yankı Transcript'e girmez ama `words` satırları durur, karışık segmentte yalnızca yankı kelimeleri düşer, kulaklıklı kayıtta hiçbir mic kelimesi atılmaz, yankı Suspect Word "düzeltilmedi" sayısına girmez, eski tek kanallı Meeting Self.
- [x] **[otomatik]** Mevcut `transcript-service.test.ts` / `approval-service.test.ts` güncellenir: `TranscriptSegment` artık `side` taşır (toEqual beklentileri).
- [~] **[elle]** Kulaklıksız örnek kayıt: ilk kayıtta (28 sn, Safari videosu + kısa sözler) video cümleleri bir kez ve Others olarak göründü; kalan yankı "uçlu" ve "bir cevap" idi → "yankı segmenti" kuralı eklendi (ADR-0007 ölçüm bölümü, tuning satırı). **Yapılacak:** düzeltme sonrası aynı türde 2–3 yeni kulaklıksız kayıtla yeniden ölç (özellikle Others ile Self'in aynı anda konuştuğu); henüz onaylanmamış `b2e1e421…` Meeting'i uygulamada açıp farkı gör (onaylı `398efe1b…` dondurulmuştur, değişmez).
- [ ] **[elle]** Kulaklıklı örnek kayıt: hiçbir `mic` kelimesi atılmaz (Self'in tüm sözü Transcript'te).
- [ ] **[elle]** Aynı anda konuşma durumu ve "evet/tamam" gibi ortak kısa kelimeler: yanlış atılan gerçek söz sayısı kabul edilebilir mi.
- [ ] **[elle]** Ölçüm sonucu ADR-0007'ye ve `docs/tuning.md` yankı penceresi satırına yazılır; pencere gerekiyorsa `ECHO_WINDOW_MS` ayarlanır.

## 08 — Side'lı Correction ve Approve

Kod tamam (shared: `composeApprovedBlocks` / `formatApprovedBlocks` / `ApprovedTranscript`; migration 7: `approved_transcripts.blocks` (JSON); `approval-service` bloklarla onaylar ve `getApproved` verir, eski satırlar tek Self bloğu; IPC `transcript:approved`; arayüz: `transcript-view.tsx` ve `approved-transcript.tsx` "Sen" / "Diğerleri" etiketli bloklar).

- [x] **[otomatik]** `shared/transcript.test.ts` (güncellendi): Side'lı `composeApprovedText`/`composeApprovedBlocks`, Recording sınırında birleşmeme, boş blok düşer, `groupIntoBlocks`.
- [x] **[otomatik]** `transcript/approval-service.sides.test.ts`: onayda sıralı (side, text) blokları + düz metin biçimi sabit; onaydan sonra değişmez; eski tek metinli Approved Transcript okunur (tek Self bloğu, boş metin → blok yok); onaylanmamış hata.
- [x] **[otomatik]** Mevcut `approval-service.test.ts` güncellenir: onay metni artık "Sen: …" biçiminde (eski beklentiler `approved_transcripts.text` düz metin varsayıyordu).
- [ ] **[elle]** Correction ekranında bloklar "Sen" / "Diğerleri" etiketli; Recording ayraçları duruyor; uzun Transcript'te kaydırma akıcı (blok bileşeni `memo`'lu).
- [ ] **[elle]** Suspect Word tıklanınca kelimenin kendi kanalı çalar: Others bloğundaki kelime Safari/diğer katılımcı sesini, Sen bloğundaki kelime kendi sesini çalar.
- [ ] **[elle]** Onayla: Approved Transcript Side bloklarıyla görünür; onaydan sonra `recordings/<meeting>/` klasöründe hiçbir `.wav` kalmaz (mic.wav ve system.wav silindi).
- [ ] **[elle]** Bu özellikten önce onaylanmış bir Meeting (eski veritabanı) bozulmadan açılır ("Sen" etiketli tek blok).

## Mevcut testlerden kırılanlar (çalıştırmada tespit edildi ve düzeltildi)

Çalıştırmada 9 test kırıldı, hepsi aşağıdaki beklenen sebeplerden: `recording-service.test.ts` (2: iki kanal satırı), `approval-service.test.ts` (4: "Sen: " biçimi), `transcribe-recording.test.ts` (2: fazladan ilerleme bildirimi kaldırıldı; yazma hatası testi artık tetikleyiciyle), yeni `recovery.channels.test.ts` (1: beklenti hatası, kod doğru). Diğer mevcut testler değişmeden geçti. Aşağıdaki liste ilk tahmindi:

- `recording-service.test.ts`, `recording-service.close-failure.test.ts`: artık iki dosya/iki fd/iki kanal satırı (sayım, fd ve dosya yolu beklentileri); `hasSystemAudioConsent` seçeneği eklendi (iki dosyada da eklendi).
- `recovery.test.ts`: tek kanallı eski Recording'ler hâlâ onarılmalı (kırılmamalı; kırılırsa `markRecordingEnded`/gruplama).
- `database.test.ts`: şema sürümü/migration sayısı (7) ve `recording_channels` şeması.
- `transcribe-recording.test.ts`, `transcription-queue.test.ts`: kanal başına `transcribed_at`; kuyruk ağırlığı sorgusu.
- `transcript-service.test.ts`: segmentler artık `side` taşır (`toEqual`).
- `approval-service.test.ts`: onay metni "Sen: …" biçimi.
- `open-meeting-status.test.ts` ve `RecorderSnapshot` kuran diğer testler: yeni snapshot alanları (`systemLevel`, `consentRequiredFor`, `quietMeetingFor`, `systemAudioDeniedFor`, `interrupted`).

## Uçtan uca (hepsi bittikten sonra)

Bir kez temiz veritabanıyla, gerçek bir toplantıya yakın senaryo:

- [ ] **[elle]** Kulaklıksız: Safari'de iki kişili konuşma videosu çal, aynı anda sen de konuş → Recording → durdur → Transcribe → Transcript'te Others (video) ve Sen (sen) ayrı bloklarda, video cümleleri bir kez.
- [ ] **[elle]** Kulaklıklı (kablolu ve AirPods): aynı senaryo; AirPods'ta kayıt başlatma ve sürdürme (profil geçişi ses grafiğini takmıyor).
- [ ] **[elle]** Correction yap → Approve → Approved Transcript'te Side blokları; sesler silinmiş.
- [ ] **[elle]** Çökme: kayıt sırasında uygulamayı zorla kapat → aç → Recording onarılmış, Transcribe edilebilir.
- [ ] **[elle]** Transcription sürerken uygulamayı kapat → aç → yalnızca kalan kanal/Recording işlenir.
- [ ] **[elle]** İki izinden biri kapalıyken kayıt başlamaz (mikrofon izni kapalı; sistem sesi izni kapalı), açıklama + ayar bağlantısı görünür.
- [ ] **[elle]** Sistem sesinin yakalandığı çıkış cihazı değişimi/uyku/ekran kilidi gibi durumlarda uygulama kararlı kalır.
- [ ] **[otomatik]** Tüm issue'lar için kabul kriterleri işaretlenir; issue durumları `resolved` yapılır; spec'in kabul kriterleri ve "Doğrulanmamış varsayımlar" bölümü güncellenir.

