Status: ready-for-agent
Blocked by: 07

# Correction ekranında ve Approved Transcript'te Side

Spec: [../spec.md](../spec.md) → "5. Correction ve Approve"

## Yapılacaklar

- Correction ekranı: Transcript "Sen" / "Diğerleri" etiketli bloklar; Recording ayraçları kalır.
- `approved_transcripts`: Side blokları saklanır (sıralı `(side, text)`); düz metin görünümü "Sen: …" / "Diğerleri: …". Biçim testle sabitlenir; Analysis Request bu biçimi gönderecek.
- Mevcut Approved Transcript'ler (tek metin) okunabilir kalır: tek Self bloğu sayılır.

## Kabul kriterleri

- [ ] Correction ekranında bloklar Side etiketlidir; Suspect Word tıklanınca kendi kanalı çalar.
- [ ] Onaydan sonra Approved Transcript Side bloklarını içerir ve değişmez (test).
- [ ] Eski tek metinli Approved Transcript'ler bozulmadan gösterilir.
