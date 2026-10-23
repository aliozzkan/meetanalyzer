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
