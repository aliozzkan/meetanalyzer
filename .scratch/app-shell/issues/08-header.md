Status: ready-for-agent
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
- [ ] Recording'de Meeting varken sidebar'da "Yeni Meeting" görünmez, header'da "Açık Meeting'e dön" görünür.
- [ ] Geri/ileri okları ⌘[ / ⌘] ile aynı davranır.
- [ ] Pencerede dikey kaydırma çubuğu ya da alt boşluk oluşmaz (1100×720 ve 760×520).
- [ ] 03'teki `sidebar-top` testleri yeni yerleşimde de geçer (gerekirse header'a göre yeniden adlandırılır).
