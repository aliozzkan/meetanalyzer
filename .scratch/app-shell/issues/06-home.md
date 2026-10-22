Status: ready-for-agent
Blocked by: 01, 02, 07

# Home ekranı

Spec: [../spec.md](../spec.md) → "Home"

## Yapılacaklar

- `#/` içeriği: büyük "Yeni Meeting" CTA'sı ve açık dil seçimi (varsayılan Default Language, issue 02). Issue 01'deki geçici Home kalkar.
- `ModelCard` onboarding'i Home'a taşınır; "Şimdilik atla"/`forceAsk` davranışı aynen korunur. Model dışındaki durumlarda (hazır) hiçbir şey göstermez.
- "Senden işlem bekleyenler": `closed` ve `transcribed` Meeting'lerin kompakt listesi (Title/saat, durum, tarih); tıklanınca Meeting açılır. Boşsa bölüm gizli.
- Açık Meeting varken CTA yerine "Açık Meeting'e dön" gösterilir (header pill'iyle aynı kural, issue 08).
- `forceAsk` sorusunun Meeting sayfasında da çıkması (issue 05) korunur.

## Kabul kriterleri

- [ ] Model yokken Home'da onboarding kartı görünür; atla/indir akışı bugünkü gibi çalışır.
- [ ] Closed ve Transcribed Meeting'ler listelenir, Transcribing/Approved listelenmez.
- [ ] İndirme sürerken ilerleme hem Home'da hem header'daki model göstergesinde (issue 07) tutarlıdır.
- [ ] Model yokken detaydan ya da sidebar'dan "Metne dök" denince `forceAsk` sorusu Meeting sayfasında da çıkar (issue 05'te eklendi; Home yeniden yazılırken korunur).

## Comments

**2026-10-22 (app-shell gözden geçirmesi):** Model göstergesi footer'dan header'a taşındı (issue 07), bu yüzden 07'ye bağlandı; sıra 08 → 07 → 06. İçerik alanında artık `DotPattern` arka planı var (`af13cf8`); Home tasarımı bunun üstüne oturur.
