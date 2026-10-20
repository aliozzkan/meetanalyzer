Status: resolved

# Uygulama kabuğu: router, sidebar, global recorder

Spec: [../spec.md](../spec.md) → "Yerleşim", "Sidebar" (liste), "Meeting detayı", "Global Recorder"

Sonraki dilimler bu kabuğun üzerine biner. Bu dilim bittiğinde uygulama yeni düzende çalışır; Yeni Meeting butonu, Ayarlar, tema ve Title henüz yok.

## Yapılacaklar

- **Global recorder:** `useRecorder`'ı `MeetingDetail`'den çıkarıp uygulama seviyesinde tek bir recorder (context/provider) yap. Unmount'ta kaydı bitirme mantığı yalnızca uygulama kapanışına ve Meeting silinmesine bağlansın. `RecordingControls` bu state'i okusun. (Bu dilimde yeni bir sidebar pill'i yok; o issue 03'te.)
- **Hash router:** `#/` ve `#/meetings/:id`; ⌘[ / ⌘] geri/ileri; yenilemede açık Meeting korunur. `useState` ile ekran geçişi kalkar. Var olmayan `:id` için "Bu Meeting artık yok" durumu Home'a yönlendirsin.
- **Pencere:** macOS'ta `titleBarStyle: 'hiddenInset'` (sürükleme alanı dahil), varsayılan 1100×720, minimum 760×520. Windows/Linux'ta normal başlık çubuğu.
- **Sidebar:** shadcn `Sidebar`, sabit genişlik; ⌘B ile ikon moduna daralma; dar pencerede otomatik daralma; durum `localStorage`'da (try/catch ile). Mevcut neobrutalism token'ları.
- **Meeting listesi:** tarih grupları (Bugün, Dün, Son 7 gün, Son 30 gün, sonra ay bazında), boş gruplar gizli, en yeni üstte. Tek satırlı satır: durum ikonu, saat ("14:30 Meeting'i"; Title issue 04'te gelir), sağda soluk saat. Durum ikonları spec'teki gibi. Seçili satır `--main` ile vurgulu. Liste boşsa soluk "Henüz Meeting yok".
- **Geçici Home:** `#/` şimdilik mevcut `ModelCard` ve "Yeni Meeting" (dil select'iyle) içerir; kalıcı hâli issue 06'da. Yeni Meeting başlatma geçici olarak bu ekrandan yapılır.
- **Detay:** "← Meeting'ler" butonu kalkar; başlık bölgesi (tarih, dil, kayıt sayısı, durum badge'i, aksiyonlar); içerik `max-w-3xl` ortalı kolonda.
- Meeting silinince (açıksa) Home'a dön.

## Kabul kriterleri

- [x] Kayıt sürerken sidebar'dan başka bir Meeting'e/Home'a geçmek kaydı durdurmaz; geri dönünce süre ve seviye göstergesi akmaya devam eder.
- [x] Kayıt sürerken Meeting silinirse kayıt düzgünce biter ve Home'a dönülür.
- [x] Uygulamayı yenilemek açık Meeting'i `#/meetings/:id`'den geri getirir; ⌘[ / ⌘] çalışır.
- [x] Gruplama sınırları (gece yarısı, 7/30 gün, ay) birim testiyle doğrulanır.
- [x] 760 px genişlikte sidebar ikon moduna iner, içerik taşmaz; yeniden başlatınca ⌘B ile seçilen durum korunur.
- [x] macOS'ta trafik ışıkları sidebar üstünde, pencere sürüklenebilir.
- [x] Mevcut Transcription/Correction/Approve akışları değişmeden çalışır.

## Comments

**2026-10-12 (implementasyon + review sonrası):**

- **Doğrulama sınırı:** Arayüz, geçici bir `window.api` stub'ıyla tarayıcı pane'inde denendi (rotalar, yenileme, gruplama, daralma, silme, izin uyarısı); gerçek Electron penceresinde, gerçek mikrofonla ve macOS trafik ışıklarıyla **denenmedi**. İşaretlenmeyen kriterler bu yüzden açık: Recording sürerken gezinme/silme (controller testleri mantığı kapsıyor, uçtan uca değil), trafik ışıkları + sürükleme alanı, mevcut Transcription/Correction/Approve akışı. `trafficLightPosition` (x:16) ikon modundaki 48 px sidebar'dan geniş; ışıklar içerik şeridine taşabilir, gözle kontrol gerekir.
- **760 px:** shadcn sidebar'ı Tailwind `md:` (768 px) kırılımıyla gizliyordu; minimum pencere 760 olduğundan sidebar kaybolacaktı. `sidebar.tsx`'ten `md:` kırılımı ve off-canvas (mobile) kipi çıkarıldı.
- **Satırın sağındaki metin:** spec "soluk saat" diyordu; saat zaten satır adında ("14:30 Meeting'i") olduğu için sağda kısa tarih ("12 Eki") gösteriliyor.
- **Router:** `react-router` (`createHashRouter`, layout rotası + `Outlet context`) kullanıldı. Recorder, Meeting listesi, model ve Transcription durumu layout rotasında yaşar.
- **Recorder:** mantık `recorder-controller.ts`'e (React'siz, test edilebilir) taşındı; `useRecorder` ince bir sarmalayıcı. `stop`/`stopQuietly` Recording tamamen bitene (ya da başlatma iptal edilene) kadar bekler, böylece Meeting silme kayıt bitmeden çalışmaz. İzin uyarısı `microphoneDeniedFor` ile ilgili Meeting'e bağlıdır.
- **Kısayollar:** ⌘[ / ⌘] Türkçe Q klavyede Option gerektirdiği için `alt` kısıtı yok; karakter ya da fiziksel tuş (`BracketLeft/Right`) eşleşmesi yeter.
- **Sidebar tercihi:** ⌘B seçimi her genişlikte `localStorage`'a yazılır; dar pencerede otomatik daralma kalıcı değildir.
- **Geçici Home:** "Meetanalyzing" başlığı + Yeni Meeting (dil select'iyle) + ModelCard. Sidebar başlığındaki "Meetanalyzing" bağlantısı Home'a dönüş yolu olarak bırakıldı (üst alanın geri kalanı issue 03).
- **Kapsam dışı bırakılanlar (review):** `format-date` ile tarih biçimlendirmesinin tek yerde toplanması, `app/` ↔ `features/` arası çift yönlü import, `IS_MAC`'in preload'dan gelmesi.

**2026-10-20 (manuel doğrulama):**

- Gerçek Electron penceresinde ve gerçek mikrofonla denendi: Recording sürerken gezinme ve silme, macOS trafik ışıkları ve sürükleme alanı (ikon modu dahil), Transcription/Correction/Approve akışı. Hepsi beklendiği gibi çalışıyor.
