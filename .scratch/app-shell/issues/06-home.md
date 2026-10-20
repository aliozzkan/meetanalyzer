Status: ready-for-agent
Blocked by: 01, 02

# Home ekranı

Spec: [../spec.md](../spec.md) → "Home"

## Yapılacaklar

- `#/` içeriği: büyük "Yeni Meeting" CTA'sı ve açık dil seçimi (varsayılan Default Language, issue 02). Issue 01'deki geçici Home kalkar.
- `ModelCard` onboarding'i Home'a taşınır; "Şimdilik atla"/`forceAsk` davranışı aynen korunur. Model dışındaki durumlarda (hazır) hiçbir şey göstermez.
- "Senden işlem bekleyenler": `closed` ve `transcribed` Meeting'lerin kompakt listesi (Title/saat, durum, tarih); tıklanınca Meeting açılır. Boşsa bölüm gizli.
- Açık Meeting varken CTA yerine "Açık Meeting'e dön" gösterilir (issue 03 ile aynı kural).

## Kabul kriterleri

- [ ] Model yokken Home'da onboarding kartı görünür; atla/indir akışı bugünkü gibi çalışır.
- [ ] Closed ve Transcribed Meeting'ler listelenir, Transcribing/Approved listelenmez.
- [ ] İndirme sürerken ilerleme hem Home'da hem sidebar footer'ında (issue 07) tutarlıdır.
