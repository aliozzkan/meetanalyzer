---
status: accepted
---

# Transcription ve spell check cihaz üzerinde, lokal yapılır

Transcription ve spell check uygulamanın içinde, kullanıcının cihazında çalışır; ses kaydı cihazdan çıkmaz ve backend'e yalnızca Approved Transcript (metin) gönderilir. Backend ekibi yalnızca analizden sorumludur. Alternatif olarak sesi harici bir transcription servisine göndermek düşünüldü; toplantı seslerinin üçüncü tarafa gitmemesi için reddedildi. Aynı sebeple onaydan önce Transcript'in herhangi bir parçasını (ör. Suspect Word içeren segmentleri) LLM ile düzeltmek için sunucuya göndermek de reddedildi.

> Suspect Word'lerin klasik spell check ile değil Transcription güveniyle belirlenmesi kararı için bkz. [ADR-0002](./0002-suspect-words-from-transcription-confidence.md).

## Consequences

- Transcription kalitesi ve süresi kullanıcının cihazına bağlıdır; uzun toplantılarda Closed durumunda belirgin bekleme olabilir.
- Her Language (şimdilik Turkish ve English) transcription modeli tarafından desteklenmelidir; yeni dil desteği buna bağlıdır.
- Uygulama paketi büyür ya da modeller ilk kullanımda indirilir.
