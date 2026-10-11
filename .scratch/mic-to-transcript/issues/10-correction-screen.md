Status: ready-for-agent
Blocked by: 09

# Correction ekranı

Spec: [../spec.md](../spec.md) → "5. Correction"

## Yapılacaklar

- `transcribed` Meeting'in Transcript'i segment segment, salt okunur; Recording sınırları ince ayraçla. Tiptap / contenteditable yok.
- Yalnızca `is_suspect` kelimeler görsel olarak vurgulu ve tıklanabilir; tıklanınca popover/input. Mevcut Correction varsa düzeltilmiş metin gösterilir (orijinal tooltip'te).
- Correction serbest metin: boşluk içerebilir, boş olabilir (kelimeyi siler). Yalnızca o kelimenin yerine geçer.
- `corrections` tablosuna `word_id` başına tek satır (upsert): `original`, `corrected`, `language`, `created_at`. Correction geri alınabilir (satır silinir).
- Main'de, Correction'ın yalnızca `is_suspect = 1` ve `transcribed` durumundaki Meeting'e ait kelimeye yazılabildiğini zorunlu kıl.
- Uzun Transcript'ler için performans: liste sanallaştırma gerekiyorsa ekle (1 saatlik toplantı ~10k kelime).

## Kabul kriterleri

- [ ] Suspect olmayan kelime düzenlenemez (UI ve main tarafında).
- [ ] Boş ve çok kelimeli Correction kaydedilir ve doğru gösterilir.
- [ ] 1 saatlik Transcript'te kaydırma akıcıdır.
