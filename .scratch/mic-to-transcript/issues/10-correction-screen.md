Status: resolved
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

- [x] Suspect olmayan kelime düzenlenemez (UI ve main tarafında).
- [x] Boş ve çok kelimeli Correction kaydedilir ve doğru gösterilir.
- [x] 1 saatlik Transcript'te kaydırma akıcıdır.

## Comments

**2026-10-12 (implementasyon + review sonrası):**

- Kaydırma, tarayıcı pane'inde 10 bin kelimelik sentetik Transcript'le ölçüldü (gerçek Electron'da değil, aynı Chromium): DOM ~980 düğüm, kaydırma adımı başına layout ≤0,3 ms, `contain-intrinsic-size` tahmini gerçek toplam yüksekliğe göre %4,4 sapıyor. Sanallaştırma kütüphanesi eklenmedi; `memo` + `content-visibility:auto` yeterli. Gerçek kayıtta takılma görülürse `@tanstack/react-virtual` düşünülür.
- **Issue 12'ye not:** Boş Correction ("silme") dondurulan Approved Transcript'te kelimeyi tamamen kaldırmalı (ekranda üstü çizili görünür, metinde yer almaz). `getTranscript` Approved Meeting için de okur; düzeltme/geri alma yalnızca `transcribed` durumunda çalışır.
- Aynı kelimenin kaydet/geri al çağrıları renderer'da sıraya konur; Correction `trim()` main'de yapılır ve saklanan değer döner.
