Status: ready-for-agent
Blocked by: 01, 02

# Yeni Meeting split button'u ve kayıt pill'i

Spec: [../spec.md](../spec.md) → "Sidebar > Üst alan", "Kısayollar"

## Yapılacaklar

- Sidebar üstünde üç durum:
  - Açık Meeting yok → split button: ana kısım Default Language ile hemen başlatır, ▾ dil seçip başlatır.
  - Recording durumunda Meeting var, kayıt yok → nötr "Açık Meeting'e dön" pill'i (split button gizli).
  - Kayıt sürüyor → kırmızı "● Kayıt sürüyor · mm:ss" pill'i + durdur butonu; pill tıklanınca Meeting açılır. Durdur, global recorder'ı (issue 01) kullanır.
- Başlatılan Meeting otomatik açılır.
- ⌘N: Default Language ile Yeni Meeting; açık Meeting varsa ona git. macOS menüsünde File > Yeni Meeting.
- Issue 01'deki geçici Home'daki başlatma kontrolü kalabilir (kalıcı Home issue 06'da).
- Sidebar ikon modunda pill ve buton ikona indirgenir (kırmızı nokta + tooltip).

## Kabul kriterleri

- [x] Üç durum arasındaki geçişler doğru çalışır (başlat → kayıt → durdur → Meeting'i kapat).
- [ ] Başka bir ekrandayken pill'deki durdur kaydı düzgünce bitirir (WAV geçerli, `recording_channels` süresi yazılı).
- [x] ⌘N açık Meeting varken yeni Meeting oluşturmaz.
- [x] Süre göstergesi detaydaki `RecordingControls` ile aynı değeri gösterir.

## Comments

**2026-10-20 (implementasyon + review sonrası):**

- **Doğrulama sınırı:** Tarayıcı pane'inde geçici bir `window.api` stub'ı ve sentetik mikrofon akışıyla denendi: split button ve dil menüsüyle başlatma (Meeting açılır), "Açık Meeting'e dön", Home'dan ⌘N (yeni Meeting oluşturmadan açık olana gider), detayda başlatılan kayıtta pill ile `RecordingControls`'un aynı mm:ss'i göstermesi, Home'dayken kaydın sürmesi ve pill'den durdurma, pill ile Meeting'e gitme, kapatınca "Yeni Meeting"e dönüş, ikon modunda kırmızı ikon ve tooltip. Gerçek Electron'da pill'den durdurulan kaydın WAV'ı ve `recording_channels` süresi **denenmedi** (pill, detaydaki kontrollerle aynı `recorder.stop()`'u çağırır).
- **Durum seçimi:** `sidebarTopState` (saf, testli). Recorder `starting` iken (ör. mikrofon izni beklenirken) kırmızı pill gösterilmez, "Açık Meeting'e dön" kalır; kayıt `recording` ya da `stopping` iken pill görünür, `stopping`'de durdur kapalıdır.
- **İkon modu:** Ticket'taki "ikona indirgenir" gereği yalnızca kırmızı ikon ve tooltip kalır; durdur butonu (`SidebarMenuAction`) ikon modunda gizlidir. Kayıt o modda Meeting açılarak durdurulur.
- **⌘N:** `newMeetingShortcutAction` (saf, testli). Pencere kapalıyken seçilirse 02'deki bekleyen-istek mekanizması genel bir uygulama komutu kanalına (`AppCommand`, `app:command`, `app:take-pending-command`) dönüştü; ⌘, de aynı kanalı kullanır. Uygulama açılırken gelen ⌘N, Meeting listesi ve Default Language okunana kadar bekletilir. Başlatma sürerken gelen ikinci istek (çift tıklama, art arda ⌘N) yok sayılır.
- **Menü:** macOS'ta File menüsü "Yeni Meeting" (⌘N) ve Kapat; diğer platformlarda File menüsünde "Yeni Meeting" ve "Ayarlar…".
- **Spec'te sahipsiz kalan:** Kısayollar tablosu ⌘B için View > Sidebar menü öğesi ve ⌘[ / ⌘] için menü karşılığı istiyor; 01 ve 03 kapsamında yok, ayrı bir issue'ya bırakıldı.
