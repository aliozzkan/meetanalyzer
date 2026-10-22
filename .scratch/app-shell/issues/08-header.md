Status: ready-for-human
Blocked by: 01, 03

# Header

Spec: [../spec.md](../spec.md) → "Yerleşim", "Header", "Sidebar > Üst alan"

`af13cf8`'de tam genişlikte bir header ve sağında "Planları Görüntüle" geldi; sidebar artık header'ın altında. Bu dilim header'ı kabuğun kalıcı parçası yapar ve 03'teki Recording pill'ini oraya taşır.

## Yapılacaklar

- **Sol:** macOS'ta trafik ışıkları için boşluk, "Meetanalyzing" (Home'a gider), `SidebarTrigger`, geri/ileri okları (⌘[ / ⌘] ile aynı iş; gidilecek yer yoksa devre dışı). Sidebar'ın `SidebarHeader`'ı (ve macOS'taki `pt-10`) kalkar.
- **Tam ekran:** Main, pencerenin `enter-full-screen` / `leave-full-screen` olaylarını renderer'a bildirir (ilk değer de okunabilsin); tam ekranda trafik ışığı boşluğu kalkar.
- **Orta:** 03'teki durumlar header'a taşınır (`sidebarTopState` kuralı aynen kullanılır):
  - Recording'de Meeting var, kayıt alınmıyor → nötr "Açık Meeting'e dön" pill'i.
  - Kayıt sürüyor → kırmızı "● Kayıt sürüyor · 12:34" pill'i ve durdur butonu; pill o Meeting'i açar.
  - Açık Meeting yok → boş.
- **Sidebar üst alanı:** yalnızca "Yeni Meeting" split button'u kalır; Recording'de Meeting varken gizli.
- **Sağ:** "Planları Görüntüle" yer tutucu olarak kalır (backlog 10); model göstergesinin yeri açılır (gösterge issue 07'de).
- **Sürükleme:** header'ın boş alanı macOS'ta pencere sürükleme alanı; içindeki tüm kontroller `app-no-drag`.
- **Yükseklikler:** `SidebarInset`'teki `99svh` düzeltilir; header + içerik pencereyi tam doldurur, sayfa kaymaz.
- **Windows/Linux:** native başlık çubuğu korunur; header aynı içerikle, trafik ışığı boşluğu ve sürükleme alanı olmadan.

## Kabul kriterleri

- [ ] macOS pencere modunda trafik ışıkları header'ın solundaki boşluğa oturur, hiçbir kontrolle çakışmaz; tam ekranda boşluk kalkar, çıkınca geri gelir.
- [ ] Header'ın boş alanından pencere sürüklenir; header'daki butonlara tıklamak pencereyi sürüklemez.
- [ ] Kayıt sürerken pill ve durdur header'da görünür, sidebar daralmışken de çalışır; durdur başka ekrandayken de kaydı bitirir.
- [x] Recording'de Meeting varken sidebar'da "Yeni Meeting" görünmez, header'da "Açık Meeting'e dön" görünür.
- [x] Geri/ileri okları ⌘[ / ⌘] ile aynı davranır.
- [ ] Pencerede dikey kaydırma çubuğu ya da alt boşluk oluşmaz (1100×720 ve 760×520).
- [x] 03'teki `sidebar-top` testleri yeni yerleşimde de geçer (gerekirse header'a göre yeniden adlandırılır).

## Comments

**2026-10-22 (implementasyon sonrası):**

- **Yapılan:** Header `AppHeader`'a çıktı: solda "Meetanalyzing" (Home), `SidebarTrigger`, geri/ileri okları; ortada `OpenMeetingPill`; sağda model göstergesinin yeri (yorumla işaretli) ve "Planları Görüntüle". Sidebar'ın `SidebarHeader`'ı ve macOS `pt-10`'u kalktı; sidebar üst alanı yalnızca split button, açık Meeting varken hiç render edilmez. `SidebarInset`'teki `99svh` yerine kabuk `h-svh` ve flex ile pencereyi doldurur (fazladan 1 px, header'ın border'ının yükseklik dışında kalmasından geliyordu; yükseklik artık header'ın kendisinde).
- **Saf mantık:** `sidebarTopState` → `openMeetingStatus` (`features/shell/open-meeting-status.ts`), kural aynen; yalnızca `new-meeting` durumu `none` oldu (header boş, sidebar split button'u gösterir). 03'teki beş test aynı dosyayla yeniden adlandırılıp geçiyor. Geri/ileri yapılabilirliği `historyAvailability` (react-router'ın `history.state.idx`'i ve uygulamanın giriş sayısı; 5 test). Issue 06'nın "Açık Meeting'e dön" kuralı için doğru ad artık `openMeetingStatus`.
- **Geri/ileri:** `useHistoryShortcuts` → `useHistoryNavigation`; oklar ve ⌘[ / ⌘] aynı `back`/`forward`'u çağırır. Giriş sayısı `history.length` yerine Navigation API'den (router `idx` + ileri giriş sayısı): `history.length` uygulamadan önceki girişleri de sayıyor ve ileri okunu yanlışlıkla açıyordu (tarayıcı önizlemesinde görüldü; Electron'da tek `loadURL` ile normalde fark etmez).
- **Tam ekran:** Main'de `forwardFullScreen(window)` `enter-full-screen`/`leave-full-screen`'i `app:full-screen` ile bildirir; ilk değer `app:is-full-screen` (`window.api.app.isFullScreen` / `onFullScreenChange`, renderer'da `useFullScreen`). Tam ekranda soldaki `pl-20` boşluğu kalkar.
- **Sürükleme:** Mutlak konumlu `app-drag` katmanı kalktı; `app-drag` doğrudan header'da ve yalnızca macOS'ta (Windows/Linux'ta önceden de sürükleme sınıfı vardı, kalktı). Header'daki her kontrol `app-no-drag`.
- **Doğrulama:** typecheck, test (32 dosya / 258 test), lint temiz. Tarayıcı pane'inde geçici bir `window.api` stub'ıyla denendi: 1100×720'de header 44 px, içerik 44–720, belge kaymıyor; 768×520'de (pane 768'in altında mobil emülasyonuna geçtiği için 760 yerine) aynı, sidebar ikon modunda; açık Meeting varken sidebar'da split button yok, header'da "Açık Meeting'e dön" var ve o Meeting'i açıyor; açık Meeting yokken header ortası boş, split button görünür; oklar ve ⌘[ / ⌘] ilk açılışta kapalı, gezinince/geri gelince doğru açılıp kapanıyor; header'daki daralt/aç sidebar'ı açıp kapatıyor; sahte tam ekran olayı boşluğu kaldırıp geri getiriyor.
- **Doğrulanmayan:** Gerçek Electron (trafik ışıklarının boşluğa oturması, sürükleme, gerçek tam ekran olayları, native pencerede kaydırma), kırmızı kayıt pill'i ve durdur (pane'de mikrofon yok; pill, 03'teki gibi `recorder.stop()`'u çağırır), Windows/Linux görünümü. `trafficLightPosition` (`{ x: 16, y: 14 }`) değişmedi; 44 px header'da ortalanıp ortalanmadığına gözle bakılmalı.
- **Ticket'ta yazmayan kararlar:** Header kendi bileşeninde, ortası `center` prop'uyla dışarıdan verilir (07'nin göstergesi de sağ tarafa benzer şekilde eklenebilir). Oklarda tooltip yerine `title` ("Geri (⌘[)"). Kayıt pill'i ikon moduna inmez; header'da her zaman metin + durdur. `npm run lint`'i kıran `dot-pattern.tsx`'teki iki `react-hooks/purity` hatası (`af13cf8`'den; render'da `Math.random`) indeksten türetilen deterministik bir değerle giderildi.

Denenecekler (gerçek Electron, macOS):

- [ ] Pencere modunda trafik ışıkları header'ın solundaki boşluğa oturuyor, "Meetanalyzing" ve butonlarla çakışmıyor; tam ekrana girince boşluk kalkıyor, çıkınca geri geliyor.
- [ ] Header'ın boş alanından (ortadaki pill'in yanları dahil) pencere sürükleniyor; ok, daralt/aç, pill, durdur ve "Planları Görüntüle"ye tıklamak sürüklemiyor.
- [ ] Kayıt sürerken header'da kırmızı "Kayıt sürüyor · mm:ss" pill'i ve durdur görünüyor; sidebar ikon modundayken de; Home'dayken durdur kaydı bitiriyor; pill o Meeting'i açıyor.
- [ ] 1100×720 ve 760×520'de dikey kaydırma çubuğu ya da alt boşluk yok (uzun Meeting listesi ve uzun detay sayfasıyla).

Hepsi geçince ilk üç ve altıncı kabul kriteri işaretlenip `resolved` yapılır.
