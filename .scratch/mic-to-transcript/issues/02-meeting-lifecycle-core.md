Status: ready-for-agent
Blocked by: 01

# Meeting oluşturma, kapatma, silme ve Meeting listesi

Spec: [../spec.md](../spec.md) → "2. Meeting başlatma", "3. Meeting'i kapatma ve silme"

## Yapılacaklar

- Main'de Meeting servisi; durum geçişleri tek yerden ve yalnızca docs/meeting-lifecycle.md'deki izinli geçişlerle yapılır (izinsiz geçiş hata fırlatır).
- Aynı anda en fazla bir Meeting `recording` durumunda olabilir.
- Meeting başlatırken Language seçimi (Türkçe / İngilizce, varsayılan Türkçe — config).
- Kapatma: Recording'i olmayan Meeting kapatılamaz; UI bu durumda kapatma yerine silmeyi sunar.
- Silme: `approved` öncesi her durumda; DB kayıtları ve `recordings/<meetingId>/` klasörü tamamen kaldırılır. Kuyruktaysa kuyruktan da çıkarılır.
- Preload üzerinden tipli IPC API'si (`window.api.meetings.*`).
- Renderer: Meeting listesi (durum rozetiyle) ve Meeting detay ekranı iskeleti. Recording, Transcription, Correction alanları sonraki issue'larda doldurulur.

## Kabul kriterleri

- [ ] İkinci bir Meeting `recording` durumundayken yeni Meeting başlatılamaz.
- [ ] Recording'siz Meeting kapatılamaz; silinebilir.
- [ ] Approved Meeting silinemez; diğer durumlarda silme dosyaları da kaldırır.
- [ ] Geçiş kuralları için birim testleri var.

## Comments

**2026-10-11:** Uygulandı.
- Servis: `src/main/meetings/meeting-service.ts` (`start/get/list/transition/close/remove`, `now` enjekte edilebilir). İzinli geçişler `ALLOWED_TRANSITIONS` tablosunda; 14 + 3 test.
- DB düzeyinde ek güvence: migration 2, `meetings(state) WHERE state = 'recording'` üzerinde partial unique index.
- IPC: `src/main/meetings/ipc.ts`. Servis hataları `{ ok: false, code, message }`; beklenmeyen hatalar loglanır ve `internal-error` döner.
- Ortak tipler ve `DEFAULT_LANGUAGE`: `src/shared/meeting.ts` (renderer `@shared` alias'ı).
- Arayüz: Meeting listesi + detay iskeleti, silme onayı. Gerçek uygulamada CDP ile doğrulandı (IPC kuralları, liste/detay, silme onayı, Recording'li Meeting'de kapatma).
- Template artığı `ping` IPC'si ve "Send IPC" düğmesi kaldırıldı.
