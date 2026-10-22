Status: ready-for-human
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

- [x] Model yokken Home'da onboarding kartı görünür; atla/indir akışı bugünkü gibi çalışır.
- [x] Closed ve Transcribed Meeting'ler listelenir, Transcribing/Approved listelenmez.
- [ ] İndirme sürerken ilerleme hem Home'da hem header'daki model göstergesinde (issue 07) tutarlıdır.
- [x] Model yokken detaydan ya da sidebar'dan "Metne dök" denince `forceAsk` sorusu Meeting sayfasında da çıkar (issue 05'te eklendi; Home yeniden yazılırken korunur).

## Comments

**2026-10-22 (app-shell gözden geçirmesi):** Model göstergesi footer'dan header'a taşındı (issue 07), bu yüzden 07'ye bağlandı; sıra 08 → 07 → 06. İçerik alanında artık `DotPattern` arka planı var (`af13cf8`); Home tasarımı bunun üstüne oturur.

**2026-10-22 (implementasyon sonrası):**

- **Yapılan:** Geçici Home `app/pages/home-page.tsx`'te kalıcı hâline geçti. Üstte `Empty` tabanlı bir karşılama alanı (`DotPattern`'in üstünde, sınırsız): mikrofon ikonu, başlık, kısa açıklama, büyük "Yeni Meeting" CTA'sı ve yanında dil seçimi (`NativeSelect`, Default Language önerilir; kullanıcı bu ekranda değiştirirse o kullanılır). Açık Meeting varken (`openMeetingStatus` → `open-meeting` ya da `recording`, header pill'iyle aynı kural) CTA ve dil seçimi yerine "Açık Meeting'e dön" gösterilir; başlık "Açık bir Meeting var", açıklama kayıt sürüp sürmediğine göre değişir. Altında `ModelCard` (değişmedi: `forceAsk={transcription.askingModel}`, `onSkip={transcription.declineModel}`; ilerleme zaten 07'deki `downloadPercent` ile). En altta "Senden işlem bekleyenler": yeni `features/meetings/pending-meeting-list.tsx` (`Item` satırları, `Link` ile Meeting'i açar; `MeetingStatusIcon`, `meetingLabel`, `STATE_LABELS`, `formatMeetingDate` yeniden kullanıldı). Boşsa bölüm hiç render edilmez. `meeting-page.tsx`'teki `askingModel` iken `ModelCard forceAsk` dokunulmadan kaldı.
- **Saf mantık (`features/meetings/pending-meetings.ts`, 4 test):** `pendingMeetings(meetings)`: yalnızca Closed ve Transcribed (Recording/Transcribing/Approved yok), en yeni üstte, girdi listesini değiştirmeden; işlem bekleyen yoksa boş liste.
- **Doğrulama:** typecheck, test (34 dosya / 278 test, öncesi 33 / 274), lint 0 hata (12 uyarı `dot-pattern.tsx`'ten, önceden var). Tarayıcı pane'inde geçici bir `window.api` stub'ıyla (1100×720 koyu/açık, 768×520): model yokken kart görünüyor; İndir → kart "%35 · 200 MB / 574 MB", header göstergesi de "%35"; model hazırken ne kart ne gösterge var; "Şimdilik atla" kartı gizliyor ve `model-onboarding-dismissed` bayrağını yazıyor. Atlanmışken Meeting detayındaki "Transcribe" soruyu Meeting sayfasında açıyor, orada "Şimdilik atla" kuyruğa bir şey eklemiyor; Home'dayken sidebar "⋯" > "Metne dök" soruyu Home'da açıyor. Liste: Closed ve iki Transcribed Meeting en yeni üstte, Transcribing ve Approved yok; Title yoksa "HH:mm Meeting'i"; uzun Title satırda kırpılıyor; satıra tıklayınca `#/meetings/<id>` açılıyor; işlem bekleyen yokken bölüm görünmüyor. Dil İngilizce (Default Language) önerildi, Türkçe seçilip CTA'ya basınca `meetings.start('tr')` çağrıldı ve yeni Meeting açıldı; Home'a dönünce CTA yerine "Açık Meeting'e dön" var ve o Meeting'i açıyor.
- **Doğrulanmayan:** Gerçek Electron; gerçek indirmede yüzdenin Home kartında ve header'da birlikte ilerlemesi (stub'da sabit bir ara durum denendi; ikisi de aynı `downloadPercent`'i kullanıyor), kayıt sürerken (`recording`) Home'un görünümü (pane'de mikrofon yok; kural `openMeetingStatus`'un testli `recording` dalı).
- **Ticket'ta yazmayan kararlar:** (1) Liste sırası sidebar gibi en yeni üstte (`createdAt`); durum sırayı etkilemez. (2) Satırda durum etiketinin yanında beklenen adım ("metne dökülmeyi bekliyor" / "düzeltme ve onay bekliyor"); tarih `formatMeetingDate` ile tam tarih ve saat. (3) Açık Meeting varken dil seçimi de gizlenir (yeni Meeting başlatılamaz). (4) Karşılama alanının metinleri: "Yeni bir Meeting başlat" / "Açık bir Meeting var". (5) `ModelCard` CTA'nın altında (onboarding, ana eylemi bastırmasın); `forceAsk` ile açıldığında da aynı yerde. (6) Liste satırları nokta deseninin üstünde okunsun diye yarı saydam arka plan + blur.

Denenecekler (gerçek Electron, macOS):

- [ ] Model yokken İndir: Home kartındaki yüzde ve header göstergesindeki yüzde birlikte ilerliyor, bitince kart ve gösterge kayboluyor.
- [ ] Kayıt sürerken Home'da CTA yerine "Açık Meeting'e dön" var ve kaydı süren Meeting'i açıyor; kayıt durdurulup Meeting kapatılınca CTA geri geliyor ve Meeting "Senden işlem bekleyenler"e düşüyor.
- [ ] Bir Meeting metne dökülmeye başlayınca listeden çıkıyor, Transcribed olunca geri geliyor; onaylanınca çıkıyor.

Hepsi geçince üçüncü kabul kriteri işaretlenip `resolved` yapılır.
