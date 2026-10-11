Status: ready-for-agent
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
