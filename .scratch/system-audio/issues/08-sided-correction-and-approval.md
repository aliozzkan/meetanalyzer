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

## Uygulama notu

Kod tamamlandı, testler henüz çalıştırılmadı ([test-checklist.md](../test-checklist.md)). Kabul kriterleri testten sonra işaretlenecek.

- Biçim (testle sabit): `ApprovedBlock { side: 'self' | 'others', text }`; `approved_transcripts.blocks` JSON dizisi, `text` düz metin görünümü: her blok `Sen: …` / `Diğerleri: …`, bloklar boş satırla ayrılır. Recording sınırında bloklar birleşmez, tamamen silinen blok düşer. Analysis Request bu biçimi gönderecek.
- Eski (migration öncesi) satırlarda `blocks` NULL: `getApproved` onları tek bir Self bloğu olarak okur; `getApprovedText` eski düz metni olduğu gibi döndürür.
- Arayüz: Correction ekranı ve Approved Transcript "Sen" / "Diğerleri" etiketli bloklar; Recording ayraçları kalır. Suspect Word dinletmesi 06'da kendi kanalına bağlandı.
- Not: `composeApprovedText` artık etiketli metin üretir; mikrofon-only (tek Side) Transcript'ler de "Sen: …" ile başlar (biçim tutarlılığı için).
