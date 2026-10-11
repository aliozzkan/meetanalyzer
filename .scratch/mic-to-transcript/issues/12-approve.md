Status: ready-for-agent
Blocked by: 10

# Approve: Approved Transcript'i dondur ve sesleri sil

Spec: [../spec.md](../spec.md) → "6. Approve"

## Yapılacaklar

- "Onayla" yalnızca `transcribed` Meeting'de. Düzeltilmemiş Suspect Word varsa "X Suspect Word düzeltilmedi, yine de onaylıyor musun?" onayı.
- Tek transaction: kelimeler `seq` sırasıyla, Correction varsa onun metniyle birleştirilir (boş Correction kelimeyi düşürür; boşluklar normalize edilir); Recording'ler arasında paragraf ayrımı. `approved_transcripts`'e yazılır, Meeting `approved` olur.
- Commit sonrası `recordings/<meetingId>/` silinir ve `recording_channels.file_path` temizlenir. Silme başarısız olursa açılışta yeniden denenir.
- Approved Meeting ekranı dondurulmuş metni salt okunur gösterir; Correction ve silme kapalı.

## Kabul kriterleri

- [ ] Onaydan sonra metin değiştirilemez ve ses dosyaları diskte yoktur.
- [ ] Birleştirme kuralı için birim testleri (boş, çok kelimeli Correction, noktalama).

## Comments

**2026-10-11 (issue 02 review'undan):** Silme koruması şu an `state === 'approved'`. Yaşam döngüsü Awaiting Analysis / Completed durumlarını da kapsadığında bu guard "Approved ve sonrası" olacak şekilde genişletilmeli (Analysis dilimi).
