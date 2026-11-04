Status: ready-for-agent
Blocked by: 01, 02

# `MacLoopbackSource` ve sistem sesi izni

Spec: [../spec.md](../spec.md) → "1. Bilgilendirme ve izinler", "Ses kaynakları (adapter)"

## Yapılacaklar

- Main: `session.setDisplayMediaRequestHandler` → yalnızca ses için `callback({ audio: 'loopback' })` (issue 01 video gerektiriyorsa ona göre), `restrictOwnAudio`. İzin handler'ı (`index.ts`) yalnızca bu isteğe izin verecek şekilde daraltılır; kamera hâlâ reddedilir.
- Renderer: `MacLoopbackSource`. 48 kHz stereo → 16 kHz mono dönüşümü adapter içinde (worklet ya da `AudioContext({ sampleRate: 16000 })` dönüşümü; issue 01'de ölçülen davranışa göre). Açılışta track `ended` → izin yok hatası; kayıt sırasında `ended` → `onEnded`.
- Açılış zaman aşımı mikrofonla aynı mantıkta (`OPEN_TIMEOUT_MS`).
- İzin yoksa arayüz: açıklama + "Sistem Ayarları'nı aç" (Gizlilik › Ses Kaydı deep link'i; issue 01'de doğrulanan URL).

## Kabul kriterleri

- [ ] İzin varken kaynak 16 kHz mono parçalar ve seviye üretir.
- [ ] İzin reddedilmişse açılış "izin yok" hatasıyla biter ve arayüzde Sistem Ayarları yönlendirmesi görünür.
- [ ] Recording sırasında Suspect Word dinletilirse o ses kaynağın çıktısına girmez.
- [ ] Dönüşüm (48 kHz stereo → 16 kHz mono) için birim testi var.

## Uygulama notu

Kod tamamlandı, testler henüz çalıştırılmadı ([test-checklist.md](../test-checklist.md)). Kabul kriterleri testten sonra işaretlenecek.

- Main: `setDisplayMediaRequestHandler` yalnızca `{ audio: 'loopback' }` verir (video yok); izin handler'ı `isPermissionAllowed` ile daraltıldı (`media` yalnızca ses, `display-capture` açık, diğerleri ret). `recordings:open-system-audio-settings` IPC'si `Privacy_AudioCapture` deep link'ini açar (doğrulanmadı).
- Renderer: `MacLoopbackSource` önce `video: false`, `TypeError` gelirse `video: true` + video track'ini hemen durdurma yoluyla açar; açılışta `NotAllowedError` ya da 300 ms içinde `ended` track → `AudioPermissionError('system')`; kayıt sırasında `ended` → `onEnded`.
- 48 kHz stereo → 16 kHz mono dönüşümü `AudioContext({ sampleRate: 16000 })` + tek kanallı worklet girişi ile yapılır (issue 01 ölçümüne göre değişebilir). Kabul kriterindeki dönüşüm birim testi bu yüzden yazılamadı; elle doğrulama test listesinde.
- Kaynak `use-recorder`'a bilerek bağlanmadı: main henüz kanal yazmıyor, bağlansa sistem sesi `mic.wav`'a karışırdı. Bağlama issue 04'te.
