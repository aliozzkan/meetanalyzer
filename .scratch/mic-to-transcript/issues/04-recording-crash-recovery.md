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
