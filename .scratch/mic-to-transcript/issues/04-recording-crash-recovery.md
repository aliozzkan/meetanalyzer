Status: resolved
Blocked by: 03

# Recording sırasında çökme sonrası toparlanma

Spec: [../spec.md](../spec.md) → "Çökme ve kapanma sonrası toparlanma"

## Yapılacaklar

- Açılışta `ended_at`'i boş Recording'leri bul: WAV header'ını dosya boyutuna göre onar, `ended_at`'i dosya süresine göre yaz, `recording_channels.duration_ms`'i doldur.
- Meeting `recording` durumunda kalır; kullanıcı yeni Recording ekleyebilir ya da kapatabilir.
- Boş (yalnızca header) dosyalı Recording silinir.

## Kabul kriterleri

- [ ] Recording sırasında `kill -9` ile kapatılan uygulama yeniden açıldığında dosya oynatılabilir ve süre ~son parçaya kadardır.
- [ ] Header onarımı için birim testi (yarım dosya fixture'ı) var.

## Comments

**2026-10-11 (issue 03'ten):** `recordings.ended_at IS NULL` olan satırlar bu issue'nun kapsamıdır, ancak aktif Recording yalnızca bellekte izlenir (`recording-service.ts`); açılışta kalan bu satırlar çökme artığıdır. `file_path` göreli saklanır (`<meetingId>/<recordingId>/mic.wav`), `userData/recordings` ile birleştirilmelidir. WAV header'ı kayıt sırasında `dataBytes = 0` ile yazılır; onarımda `RIFF` boyutu `fileSize - 8`, `data` boyutu `fileSize - 44` olmalı.

**2026-10-11 (issue 03 review'undan):** Boş (0 bayt) Recording ve `stopAll` ile bitirilmiş kayıtlar da bu issue'daki açılış taramasına takılabilir; taramada `ended_at` dolu satırlara dokunulmamalı. Normal çıkışta renderer'daki son ≤5 sn'nin kaybolması bilinen bir sınırdır (bkz. issue 03 notları).

**2026-10-11:** Uygulandı.
- `src/main/recordings/recovery.ts` → `recoverInterruptedRecordings({ db, recordingsDir })` `{ repaired, discarded }` döner; `index.ts` açılışta, IPC kaydedilmeden önce çalıştırır (hata olursa loglanır, uygulama açılır).
- Ses içeren dosya: yarım örnek kesilir, header gerçek boyutla yeniden yazılır, `duration_ms` doldurulur, `ended_at = started_at + süre`. Ses içermeyen (boş, header'ı yarım, dosyası hiç olmayan) Recording satırı, dosyası ve klasörüyle silinir. `ended_at` dolu satırlara dokunulmaz; ikinci çalıştırma bir şey yapmaz. Meeting durumu değişmez. `recordingsDir` dışına işaret eden yola dokunulmaz.
- `BLOCK_ALIGN` ve `BYTES_PER_SECOND` `src/shared/audio.ts`'e taşındı (servis ve onarım ortak kullanır).
- **Gerçek uygulamada doğrulandı:** 13 sn kayıttan sonra ana süreç `kill -9` ile öldürüldü: dosya 10.24 sn ses içeriyordu ama header 0 bayt diyordu (`afinfo` 0 sn). Yeniden açılışta `afinfo` 10.24 sn / 16 kHz / Int16 gösterdi, ton bozulmamıştı (439 Hz), Meeting `recording`'de kaldı, "Meeting'i kapat" ve yeni kayıt çalıştı. 5 sn dolmadan öldürülen kayıtta (yalnızca header) satır, dosya ve klasör silindi.
- **Bilinen boşluk:** `start()` önce klasör ve dosyayı, sonra DB satırlarını oluşturur; tam bu iki adım arasında çökerse satırı olmayan 44 baytlık yetim bir klasör kalır. Onarım yalnızca DB'deki satırlardan yola çıkar, yetim klasörleri taramaz. Boyutu önemsiz; gerekirse ayrı bir temizlik issue'su.
- `transcribing` durumundaki Meeting'lerin `closed`'a dönmesi issue 09'un işidir.

**2026-10-11 (code-review sonrası):** Düzeltilenler: bir satırın hatası artık diğerlerinin onarımını engellemiyor (`failed` sayacı, loglanır); DB'deki yol yalnızca `<meetingId>/<recordingId>/mic.wav` düzenine ve kayıt klasörüne uyuyorsa kabul edilir (tek segmentli yol tüm kayıt klasörünü, iki segmentli yol bir Meeting'in tüm kayıtlarını silerdi); silmede önce dosya sonra satır silinir (arada çökme satırı bırakır, sonraki açılış "dosya yok" diye temizler); süre formülü, header yazımı ve `ended_at` güncellemesi servis ve onarım arasında ortaklaştırıldı (`durationMsFromBytes`, `writeWavHeader`, `markRecordingEnded`).
Bilinen sınırlar:
- **Çok kanallı Recording** (sistem sesi, backlog 02): onarım şu an `recording_channels` satırı başına çalışır, kanal başına süre/silme kararı vermez; ikinci kanal eklenirken Recording bazında gruplanmalı (aksi halde boş bir kanal diğerinin dosyasını da siler).
- Yol doğrulaması sözcüksel; sembolik link çözülmez. Klasörü yalnızca uygulama yönettiği için risk düşük.
- `meetings.remove` da önce DB'yi, sonra dosyaları siler; arada çökme yetim klasör bırakır. Yetim klasör taraması yok.
- Header içeriği doğrulanmaz (yalnızca boyuta bakılır).
