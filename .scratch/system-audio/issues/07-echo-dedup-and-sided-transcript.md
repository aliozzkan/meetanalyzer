Status: ready-for-agent
Blocked by: 01, 06

# Yankı tekilleştirme ve Side'lı Transcript

Spec: [../spec.md](../spec.md) → "4. Transcript ve yankı (ADR-0007)"

## Yapılacaklar

- Saf fonksiyon: iki kanalın kelimeleri → yankı sayılan `mic` kelimeleri. Kural: `mic` kelimesi, tuning penceresi içinde aynı normalize yazılışla (küçük harf, noktalama atılmış) bir `system` kelimesiyle eşleşirse yankıdır. Başlangıç değeri ±1,5 sn; `docs/tuning.md`'ye satır ve config sabiti.
- `transcript-service`: segmentler başlangıç zamanına göre birleşir, ardışık aynı Side'lı segmentler blok olur; yankı kelimeleri Transcript'e girmez (`words` değişmez). Tüm kelimeleri atılan segment görünmez.
- Yankı sayılan Suspect Word'ler Correction'a ve "düzeltilmedi" sayısına girmez.
- Issue 01'in kulaklıksız kaydıyla ölçüm: kalan yankı ve yanlış atılan gerçek söz; sonuç ADR-0007'ye ve tuning satırına not.

## Kabul kriterleri

- [ ] Kulaklıksız örnek kayıtta diğer katılımcıların cümleleri bir kez ve Others olarak görünür.
- [ ] Kulaklıklı örnek kayıtta hiçbir `mic` kelimesi atılmaz.
- [ ] Tekilleştirme için birim testleri: pencere sınırı, normalize eşleşme, aynı anda konuşma (Self'in gerçek sözü korunur).
- [ ] Ölçüm sonucu ADR-0007 ve tuning'e yazılmıştır.

## Uygulama notu

Kod tamamlandı, testler henüz çalıştırılmadı ([test-checklist.md](../test-checklist.md)). Kabul kriterleri testten sonra işaretlenecek. **Ölçüm maddesi (kulaklıksız kayıtla kalan yankı / yanlış atılan söz → ADR-0007 + tuning notu) insan işidir ve yapılmadı.**

- `transcript/echo.ts`: saf `findEchoWordIds(micWords, systemWords, windowMs)`; `normalizeWord` (Türkçe küçük harf, harf/rakam dışı atılır). Her `system` kelimesi en fazla bir `mic` kelimesini yankı yapar, eşleşmede en yakın aday seçilir.
- `transcript-service.get`: Recording başına iki kanalın segmentleri başlangıç zamanına göre (eşitlikte mic önce) birleşir; yankı kelimeleri ve tüm kelimeleri atılan segmentler çıkar; `words` tablosuna dokunulmaz. `TranscriptSegment.side` (`self | others`); ardışık aynı Side'lı segmentler için `groupIntoBlocks` (arayüz issue 08'de kullanır).
- Yankı Suspect Word'leri Transcript'te olmadığı için Correction'a ve `countUncorrected` sayısına girmez.
- `ECHO_WINDOW_MS = 1500` `config.ts`'te, `docs/tuning.md`'de satırı var.
