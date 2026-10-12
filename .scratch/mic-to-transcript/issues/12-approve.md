Status: resolved
Blocked by: 10

# Approve: Approved Transcript'i dondur ve sesleri sil

Spec: [../spec.md](../spec.md) → "6. Approve"

## Yapılacaklar

- "Onayla" yalnızca `transcribed` Meeting'de. Düzeltilmemiş Suspect Word varsa "X Suspect Word düzeltilmedi, yine de onaylıyor musun?" onayı.
- Tek transaction: kelimeler `seq` sırasıyla, Correction varsa onun metniyle birleştirilir (boş Correction kelimeyi düşürür; boşluklar normalize edilir); Recording'ler arasında paragraf ayrımı. `approved_transcripts`'e yazılır, Meeting `approved` olur.
- Commit sonrası `recordings/<meetingId>/` silinir ve `recording_channels.file_path` temizlenir. Silme başarısız olursa açılışta yeniden denenir.
- Approved Meeting ekranı dondurulmuş metni salt okunur gösterir; Correction ve silme kapalı.

## Kabul kriterleri

- [x] Onaydan sonra metin değiştirilemez ve ses dosyaları diskte yoktur.
- [x] Birleştirme kuralı için birim testleri (boş, çok kelimeli Correction, noktalama).

## Comments

**2026-10-11 (issue 02 review'undan):** Silme koruması şu an `state === 'approved'`. Yaşam döngüsü Awaiting Analysis / Completed durumlarını da kapsadığında bu guard "Approved ve sonrası" olacak şekilde genişletilmeli (Analysis dilimi).

**2026-10-11 (issue 03'ten):** Ses silme sırasında `recording_channels.file_path` temizlenir; yol `recordingsDir`'e göredir (`<meetingId>/<recordingId>/mic.wav`).

**2026-10-12 (implementasyon notu):** Birleştirme `composeApprovedText` (`src/shared/transcript.ts`): aynı Recording'in segmentleri tek paragraf, Recording'ler boş satırla ayrılır, tamamen silinen Recording paragraf bırakmaz. Ses silme `purgeApprovedAudio`: onay sonrası ve her açılışta çalışır; silme başarısızsa `file_path` DB'de kalır ve açılışta yeniden denenir. Onay/Correction guard'ı yalnızca `transcribed` durumunu kabul eder. **Elle doğrulanmadı:** gerçek uygulamada onaydan sonra `userData/recordings/<meetingId>` klasörünün diskten kalktığı.
