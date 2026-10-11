Status: ready-for-agent
Blocked by: 02

# Mikrofondan PCM WAV Recording

Spec: [../spec.md](../spec.md) → "2. Meeting başlatma ve Recording", "Kayıt (ADR-0003)"

## Yapılacaklar

- İzin: ilk "Kaydı başlat"ta `systemPreferences.getMediaAccessStatus` / `askForMediaAccess('microphone')`. Reddedilmişse Recording başlamaz; açıklama + "Sistem Ayarları'nı aç" düğmesi (`x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone`). `electron-builder.yml` içindeki `NSMicrophoneUsageDescription` metnini uygulamaya uygun Türkçe/İngilizce yaz.
- Renderer: varsayılan mikrofon, `AudioContext({ sampleRate: 16000 })` + `AudioWorklet` → mono 16-bit PCM. ffmpeg / MediaRecorder yok.
- Config'teki parça süresiyle PCM → IPC → main.
- Main: `recordings/<meetingId>/<recordingId>/mic.wav` dosyasını 44 baytlık placeholder header ile açar, parçaları append eder, Recording bitince header'ı gerçek boyutla yazar. `recordings` + `recording_channels` (kind `mic`) satırlarını yönetir.
- Bir Meeting içinde birden çok Recording başlat/durdur.
- UI: ses seviyesi göstergesi; config'teki süre boyunca tam sessizlikte "Mikrofon sessiz görünüyor" uyarısı.

## Kabul kriterleri

- [ ] Üretilen WAV 16 kHz / mono / 16-bit ve QuickTime'da oynatılabilir.
- [ ] Aynı Meeting'de üç Recording alınabilir; her biri ayrı dosyadır.
- [ ] İzin reddedildiğinde Recording satırı oluşmaz ve yönlendirme görünür.
- [ ] Mikrofon sessize alındığında uyarı çıkar, ses gelince kaybolur.
- [ ] WAV header yazımı için birim testi var.

## Comments

**2026-10-11 (issue 02 review'undan):** `meetings.remove` şu an aktif bir Recording'i bilmiyor. Recording sürerken Meeting silinirse WAV writer silinen klasöre yazmaya devam eder ya da `recordings` FK hatasıyla çöker. Bu issue'da ya Recording'i durduran bir kanca (`remove` öncesi) ya da yazma sırasında Meeting'in yok olmasını zarifçe karşılayan bir yol eklenmeli; testi de yazılmalı.

**2026-10-11:** Uygulandı.
- `src/main/recordings/`: `wav.ts` (44 baytlık header), `recording-service.ts` (`start/append/stop/discard/stopAll/abortMeeting/hasActive`), `microphone.ts` (macOS izin sarmalayıcısı), `ipc.ts`. Aktif Recording yalnızca bellekte (açık dosya tanıtıcısı) tutulur; `recordings.ended_at IS NULL` kalan satırlar çökme artığıdır (issue 04).
- `recording_channels.file_path` **kayıt klasörüne göre göreli** saklanır: `<meetingId>/<recordingId>/mic.wav`. Issue 04, 11 ve 12 bu yolu `recordingsDir` ile birleştirmeli.
- Meeting servisi: aktif Recording varken `close` → `recording-active`; `remove` önce `abortMeeting` çağırır (02 review notu).
- Pencere yenilenince ve uygulama kapanırken `stopAll()` aktif Recording'leri düzgünce bitirir (header gerçek boyutla yazılır). Yenilemede renderer'da henüz gönderilmemiş son ~5 sn kaybolur.
- Renderer: `AudioWorklet` (16 kHz mono), `startMicCapture`, `useRecorder`, `RecordingControls`. `getUserMedia` 15 sn zaman aşımlıdır; mikrofon açılamazsa boş Recording `discard` ile silinir.
- Paylaşılan saf mantık `src/shared/`: `audio.ts` (sabitler), `pcm.ts`, `silence-monitor.ts` (testli).
- `build/entitlements.mac.plist`: `com.apple.security.device.audio-input` eklendi (hardened runtime altında olmazsa macOS sessiz ses verir). `NSMicrophoneUsageDescription` Türkçe/İngilizce.
- **Gerçek uygulamada doğrulandı (CDP, sentetik mikrofon akışı):** 16 kHz/mono/Int16 WAV (`afinfo` onayladı), ses süresi duvar saatinden 3–12 ms farklı, 3 ayrı Recording, sessiz mikrofon uyarısı 10 sn'de çıkıp ses gelince kalkıyor, izin reddinde satır/klasör oluşmuyor, kayıt sürerken Meeting silme ve pencere yenileme güvenli. E2E sırasında bulunan hata: oturum son parça gönderilmeden kapanıyordu (her kaydın sonu kayboluyordu), düzeltildi.
- **Bu issue'da yapılmayanlar:** gerçek mikrofon ve macOS izin penceresiyle elle doğrulama (kullanıcı), çökme sonrası header onarımı (issue 04), Recording başına liste ve oynatma (issue 10/11).

**2026-10-11 (code-review sonrası):** Düzeltilenler: `recordings:append` boyut/hizalama doğrulaması (`invalid-chunk`), `stop`/`stopAll`/`start` hata dayanıklılığı, mikrofon açılırken ekrandan çıkışta sızıntı (Recording artık `discard` ile silinir), disk hatasında Recording'in `stop` ile bitirilmesi, pencere kapanınca/renderer çökünce `stopAll`, izin handler'ının kamerayı reddetmesi, `getUserMedia` `NotAllowedError` → izin paneli.
Bilerek bırakılanlar (gerekirse ayrı issue):
- **Normal çıkışta (Cmd+Q / pencere kapatma) renderer'daki henüz gönderilmemiş son ≤5 sn kaybolur**; yalnızca ana süreçteki yazıcı bitirilir. Düzgün çözüm: kapanmadan önce renderer'a "bitir" mesajı gönderip bitmesini beklemek.
- WAV header'ı yalnızca `stop()`'ta yazılır (spec); uygulama öldürülürse boyut alanları 0 kalır. Onarım issue 04'te.
- Hemen durdurulan Recording 0 bayt/0 ms olarak kalır ve Meeting bununla kapatılabilir. Boş Recording'in `stop`'ta silinmesi ya da kapatmada engellenmesi düşünülebilir.
- Mikrofon cihazı çıkarılırsa (`track.onended`) kayıt devam ediyor gibi görünür; yalnızca sessizlik uyarısı çıkar.
- `restricted` (MDM/ebeveyn kısıtı) durumu da `denied` gibi ele alınıyor; yönlendirme mesajı bu durumda yanıltıcı olabilir.
- `setPermissionCheckHandler` tanımlı değil; yalnızca istek handler'ı var.
- Gerçek mikrofon ve macOS izin penceresiyle elle doğrulama kullanıcıda.

**2026-10-11 (paketleme):** `electron-builder.yml` → `mac.extendInfo` şablonda **liste** biçimindeydi; electron-builder harita bekler ve liste `Info.plist`'e `"0"`…`"3"` adlı anlamsız anahtarlar yazıp gerçek açıklamaları Electron'un varsayılanında bırakıyordu. Haritaya çevrildi; yalnızca `NSMicrophoneUsageDescription` tutuldu (kamera/Belgeler/İndirilenler açıklamaları kullanılmıyordu). Paketlenmiş uygulamada doğrulandı: `Info.plist` doğru metni taşıyor, imzalı pakette `com.apple.security.device.audio-input` var, worklet `app.asar` içinden yükleniyor, SQLite çalışıyor.
