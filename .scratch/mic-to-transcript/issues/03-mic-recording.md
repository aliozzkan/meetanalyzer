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
