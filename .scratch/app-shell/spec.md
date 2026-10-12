Status: needs-triage

# Uygulama kabuğu: sidebar, Home, Ayarlar

Uygulama tek kolonlu, `useState` ile ekran değiştiren bir sayfadan; solda Meeting'lerin listelendiği sidebar'ı, sağda ana içerik alanı ve Ayarlar modal'ı olan bir masaüstü kabuğuna geçer. Analysis ekranları ve detay ekranının yeniden tasarımı bu spec'in dışındadır.

Terimler [GLOSSARY.md](../../GLOSSARY.md), durumlar [docs/meeting-lifecycle.md](../../docs/meeting-lifecycle.md) ile aynıdır. Spec ile birlikte GLOSSARY'ye **Title** terimi eklendi.

## Mevcut durum

- `App.tsx` tek kolon (`max-w-3xl`); üstte `ModelCard`, altında `MeetingList` ya da `MeetingDetail` (`useState` ile geçiş, router yok).
- shadcn `sidebar`, `resizable`, `context-menu`, `command`, `tabs` bileşenleri kurulu ama kullanılmıyor.
- `ThemeProvider` yalnızca sistem temasını izliyor; elle seçim yok.
- Meeting'in başlığı yok; listede `createdAt` ile gösteriliyor. Ayar saklama yeri yok. Hesap/profil kavramı yok.
- `useRecorder` `MeetingDetail` içinde yaşıyor ve unmount olduğunda süren Recording'i sessizce bitiriyor.

## Kapsam dışı

- Profil/hesap/auth (footer ileride avatar menüsüne dönüşebilecek şekilde düzenlenir, içi boş profil sayfası yok).
- Çoklu model ve aktif model seçimi (backlog 06); mikrofon seçimi, Ayarlar > Ses (backlog 07).
- Meeting araması (backlog 09).
- Detay ekranının yeniden tasarımı; Analysis görünümü ve durumları (Send Failed, Analysis Errored…).
- Özel Windows/Linux başlık çubuğu (backlog 03).
- Sürüklenerek yeniden boyutlanan sidebar.
- Stil değişikliği: mevcut neobrutalism token'ları (kalın border, `--shadow`, seçili satır `--main`) aynen kullanılır.

## Yerleşim

- Solda shadcn `Sidebar` (sabit genişlik), sağda ana alan. macOS'ta `titleBarStyle: 'hiddenInset'`: trafik ışıkları sidebar'ın üstüne oturur, sidebar pencerenin tam yüksekliğini kaplar. Windows/Linux'ta normal başlık çubuğu.
- Varsayılan pencere 1100×720, minimum 760×520. Pencere dar olduğunda sidebar otomatik ikon moduna daralır; ⌘B ile elle daralıp açılır. Açık/kapalı durumu `localStorage`'da hatırlanır (shadcn'ın cookie yaklaşımı yerine).
- Gezinme hash router ile: `#/` Home, `#/meetings/:id` detay. Geri/ileri ⌘[ ⌘]; yenilemede açık Meeting korunur. Ayarlar rota değil, state'tir.

## Sidebar

### Üst alan (üç durum)

- **Açık Meeting yok:** "Yeni Meeting" split button'u. Ana kısım Meeting'i **Default Language** ile hemen başlatır; ▾ başka dil seçip başlatır.
- **Recording durumunda Meeting var, kayıt alınmıyor:** nötr "Açık Meeting'e dön" pill'i; split button gizli (yeni Meeting zaten başlatılamaz).
- **Kayıt sürüyor:** kırmızı "● Kayıt sürüyor · 12:34" pill'i ve **durdur** butonu; pill tıklanınca o Meeting açılır. Başka ekrandayken de kayıt durdurulabilir.

### Meeting listesi

- `createdAt`'e göre gruplar: **Bugün, Dün, Son 7 gün, Son 30 gün**, daha eskiler **ay bazında** ("Eylül 2026"). Boş gruplar gösterilmez; grup içinde en yeni üstte. Recording'deki Meeting hem üst pill'de hem kendi grubunda görünür.
- Satır tek satırdır: solda durum ikonu, ortada Title (yoksa saat, ör. "14:30 Meeting'i"), sağda soluk saat. Dil ve kayıt sayısı satırda değil detay başlığında görünür.
- Durum ikonları: Recording kırmızı nokta; Closed gri; Transcribing spinner (sırada bekliyorsa saat ikonu); Transcribed vurgulu nokta (düzeltme bekliyor); Approved tik.
- Satır aksiyonları: sağ tık context menu'su ve hover'da beliren "⋯" butonu aynı menüyü açar. Menü: Yeniden adlandır, Kapat, Metne dök, Sil. Seçenekler `MeetingActions`'taki durum kurallarına uyar; Sil yine onay dialog'undan geçer; açık olan Meeting silinirse Home'a dönülür.
- Hiç Meeting yokken liste alanında soluk "Henüz Meeting yok" metni; sidebar'da ikinci bir CTA yok.
- Arama yok (backlog 09).

### Alt alan (footer)

- **Ayarlar** girişi.
- **Tema menüsü:** ikon butonu (güneş/ay/monitör), menüde **Sistem / Açık / Koyu**; Ayarlar > Genel'deki Tema ile aynı değeri paylaşır. Seçim `localStorage`'da; varsayılan Sistem. Main process'te `nativeTheme.themeSource` de güncellenir (native menüler, scrollbar, dialog'lar uyar).
- **Model göstergesi:** model hazırsa görünmez; eksikse "Model indirilmedi"; indirme sürerken ince ilerleme çubuğu ve yüzde; hatada kırmızı "İndirme başarısız". Tıklanınca Ayarlar > Transcription Modeli açılır.

## Home (`#/`)

- Büyük "Yeni Meeting" CTA'sı, yanında açık dil seçimi (varsayılanı Default Language).
- Model eksikse onboarding kartı (bugünkü `ModelCard` buraya taşınır; "Şimdilik atla" ve `forceAsk` davranışı korunur). İndirme sürerken ilerleme sidebar footer'ında da görünür.
- "Senden işlem bekleyenler": **Closed** (metne dökülmeyi bekliyor) ve **Transcribed** (düzeltme/onay bekliyor) Meeting'lerin kompakt listesi; tıklanınca Meeting açılır. Analysis durumları (Approved'da analiz, Send Failed, Analysis Errored) kodda gelince listeye eklenir.

## Meeting detayı

Yalnızca kabuk değişir; durum panellerinin içi (kayıt kontrolleri, transcript, onay) değişmez.

- "← Meeting'ler" butonu kalkar.
- Başlık bölgesi: inline düzenlenebilir Title (boşsa yer tutucu olarak tarih), dil, kayıt sayısı, durum badge'i, aksiyonlar.
- İçerik `max-w-3xl` ortalı kolonda kalır.

## Title

- İsteğe bağlı; boş olabilir, en fazla 120 karakter, baştaki/sondaki boşluklar kırpılır (main'de zorunlu kılınır).
- **Yalnızca lokal**: Analysis Request ile backend'e gönderilmez (toplantı adı müşteri/proje adı içerebilir).
- **Her durumda düzenlenebilir**, Approved'dan sonra da.
- Detay başlığında inline, sidebar'da sağ tık/"⋯" → Yeniden adlandır ile düzenlenir.
- `meetings` tablosuna nullable `title` sütunu (yeni migration); mevcut migration'lar değiştirilmez.

## Global Recorder

- `useRecorder` detay ekranından alınıp uygulama seviyesinde tek bir recorder olur (domain zaten aynı anda tek Recording'deki Meeting'e izin veriyor).
- Recording gezinmeden bağımsız sürer; yalnızca kullanıcı durdurduğunda, Meeting silindiğinde ya da uygulama kapandığında biter. Detaydaki `RecordingControls` ve sidebar pill'i aynı state'i (süre, seviye, sessizlik uyarısı) okur.
- Bu, sidebar gezinmeyi mümkün kıldığı için kabuk diliminin parçasıdır; aksi halde kullanıcı Recording sırasında başka bir yere tıklayıp kaydı farkında olmadan kaybeder.

## Ayarlar modal'ı

Sidebar footer'ından, ⌘, ile ve macOS uygulama menüsündeki "Ayarlar…" ile açılır; solunda bölüm menüsü olan büyük bir dialog. Recording sürerken güvenle açılıp kapanır.

- **Genel:** Tema (Sistem/Açık/Koyu), Default Language (backlog 08 bu spec'e dahildir; varsayılan Türkçe, ayar kalıcıdır).
- **Transcription Modeli:** tek satırlık model listesi (liste biçimi backlog 06 için hazır). Durum, boyut, indir/iptal/yeniden dene, **sil**, "Finder'da göster".
  - Silme, Transcription Queue'da işlenen ya da bekleyen Meeting varken ya da indirme sürerken devre dışıdır; nedeni tooltip'te yazar.
  - Silmeden önce onay sorulur. Silince durum `missing` olur; sonraki "Metne dök" mevcut `forceAsk` akışıyla indirme sorusunu yeniden açar. "Şimdilik atla" bayrağı sıfırlanmaz.
- **Hakkında:** uygulama sürümü, whisper sürümü, veri klasörünü Finder'da göster.
- "Ses" bölümü yok (backlog 07), boş yer tutucu da konmaz.

## Kısayollar

| Kısayol | Ne yapar |
| --- | --- |
| ⌘N | Default Language ile Yeni Meeting; açık Meeting varsa ona gider |
| ⌘B | Sidebar'ı daralt/aç |
| ⌘, | Ayarlar |
| ⌘[ / ⌘] | Geri/ileri |

Hepsi macOS uygulama menüsünde de görünür (File > Yeni Meeting, View > Sidebar, App > Ayarlar…).

## Dilimler

Her dilim tek başına çalışır durumda bırakılır. Sıra ve bağımlılıklar `issues/` altında.

1. Uygulama kabuğu (global recorder dahil)
2. Ayarlar modal'ı ve tema (Default Language dahil)
3. Yeni Meeting split button'u ve kayıt pill'i
4. Meeting Title
5. Satır aksiyonları
6. Home ekranı
7. Transcription Modeli bölümü ve footer göstergesi
