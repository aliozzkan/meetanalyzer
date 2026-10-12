Status: needs-triage

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

- [ ] Kayıt sürerken sidebar'dan başka bir Meeting'e/Home'a geçmek kaydı durdurmaz; geri dönünce süre ve seviye göstergesi akmaya devam eder.
- [ ] Kayıt sürerken Meeting silinirse kayıt düzgünce biter ve Home'a dönülür.
- [ ] Uygulamayı yenilemek açık Meeting'i `#/meetings/:id`'den geri getirir; ⌘[ / ⌘] çalışır.
- [ ] Gruplama sınırları (gece yarısı, 7/30 gün, ay) birim testiyle doğrulanır.
- [ ] 760 px genişlikte sidebar ikon moduna iner, içerik taşmaz; yeniden başlatınca ⌘B ile seçilen durum korunur.
- [ ] macOS'ta trafik ışıkları sidebar üstünde, pencere sürüklenebilir.
- [ ] Mevcut Transcription/Correction/Approve akışları değişmeden çalışır.
