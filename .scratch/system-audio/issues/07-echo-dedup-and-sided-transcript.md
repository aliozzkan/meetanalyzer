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
