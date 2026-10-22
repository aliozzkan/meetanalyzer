Status: ready-for-human
Blocked by: 02, 08

# Transcription Modeli bölümü ve header göstergesi

Spec: [../spec.md](../spec.md) → "Ayarlar modal'ı > Transcription Modeli", "Header"

## Yapılacaklar

- **Ayarlar > Transcription Modeli:** tek satırlık model listesi (backlog 06'da satır eklenebilsin diye liste biçiminde). Satır: ad, boyut, durum. Eylemler: indir / iptal / yeniden dene (mevcut `ModelApi`), **sil**, "Finder'da göster".
- **Sil:** Transcription Queue'da işlenen/bekleyen Meeting varken ya da indirme sürerken devre dışı (tooltip'te neden); önce onay; silince model durumu `missing`. Main'de `ModelService`'e silme ve IPC ekle; kuralı main'de de zorunlu kıl (UI'ya güvenme).
- Silme sonrası sonraki "Metne dök", mevcut `forceAsk` akışıyla indirme sorusunu yeniden açar; "Şimdilik atla" bayrağı sıfırlanmaz.
- **Header göstergesi** (header'ın sağında, "Planları Görüntüle"nin solunda; yeri issue 08'de açılır): hazırsa görünmez; eksik → "Model indirilmedi"; indirme → ince ilerleme çubuğu + yüzde; hata → kırmızı "İndirme başarısız". Tıklanınca Ayarlar > Transcription Modeli açılır.

## Kabul kriterleri

- [x] Silme, kuyruk doluyken ya da indirme sürerken hem UI'da hem main'de reddedilir.
- [ ] Silme sonrası diskte model dosyası ve kısmi indirme kalıntısı kalmaz; durum `missing` olur.
- [ ] Silinen model ile "Metne dök" indirme sorusunu açar ve onaylanırsa tekrar indirir.
- [x] Header göstergesi dört durumda doğru görünür, sidebar daralmışken de görünür; model hazırken hiç yer kaplamaz.
- [x] `ModelService` silme testleri: hazır model, olmayan model, indirme sürerken.

## Comments

**2026-10-22 (app-shell gözden geçirmesi):** Gösterge sidebar footer'ı yerine header'ın sağına taşındı (sidebar ikon moduna daralsa da görünsün diye). Footer'da yalnızca Ayarlar ve Tema kalır. Header düzeni issue 08'de geldiği için ona bağlandı.

**2026-10-22 (implementasyon sonrası):**

- **Yapılan (main):** `ModelService.remove()`: model dosyasını ve `.part` kalıntısını siler, durumu `{ status: 'missing', partialBytes: 0 }` yapar ve yayınlar. İndirme sürerken (iptal edilmiş ama henüz çözülmemiş indirme dahil, `.part`'a hâlâ yazıyor olabilir) `ModelError('download-in-progress')`, Transcription Queue'da işlenen ya da bekleyen Meeting varken `ModelError('in-use')` fırlatır. Kuyruk kuralı servise enjekte edilen `isInUse` sorgusuyla gelir; `index.ts`'te kuyruğun `getStatus()`'una geç bağlanır (kuyruk modele bağlı kurulduğu için). Yeni paylaşılan yardımcı: `hasPendingTranscription(status)` (`src/shared/transcription.ts`). IPC: `model:remove` (`ModelResult<ModelState>`, `toIpcResult` ile) ve `model:show-in-folder` (model kuruluysa dosya `shell.showItemInFolder` ile seçili gösterilir, değilse modeller klasörü `shell.openPath` ile açılır; hata mesajı döner, `app.showDataFolder` deseni). Preload: `model.remove`, `model.showInFolder`.
- **Yapılan (renderer):** Ayarlar'a "Transcription Modeli" bölümü (`SETTINGS_SECTIONS = ['general', 'model', 'about']`) ve `features/model/model-section.tsx`: tek satırlık `<ul>` (ad, boyut, durum; indirme sürerken ince ilerleme, hatada mesaj). Eylemler: İndir / Devam et (yarım dosya varken) / İptal / Yeniden dene, "Finder'da göster" (macOS dışında "Klasörü aç"), Sil. Sil devre dışıyken nedeni tooltip'te (`focusableWhenDisabled` ile buton hover/odak alır); etkinken `AlertDialog` onayı. `useModel` → `remove()` (red nedenini toast'ta gösterir) ve `showInFolder()`. "Şimdilik atla" bayrağına dokunulmadı. Header göstergesi `features/model/header-model-indicator.tsx`, `AppHeader`'ın yeni `modelIndicator` slot'u ile "Planları Görüntüle"nin soluna girer; tıklanınca `settings.openAt('model')`.
- **Saf mantık (`features/model/model-status.ts`, 10 test):** `downloadPercent` (ModelCard, gösterge ve Ayarlar aynı yüzdeyi gösterir), `megabytes` (ModelCard'dan taşındı), `modelIndicator(state)` (ready/null → null, missing, downloading + yüzde, error), `removeBlockReason(state, transcriptionStatus)` (tooltip metni ya da null).
- **Doğrulama:** typecheck, test (33 dosya / 274 test, öncesi 32 / 258; `ModelService`'e 6 silme testi: hazır model, olmayan model ve yalnızca `.part`, hata durumundaki yarım dosya, indirme sürerken, iptal edilip henüz çözülmemiş indirme, kuyruk doluyken), lint 0 hata (12 uyarı `dot-pattern.tsx`'ten, önceden var). Tarayıcı pane'inde geçici bir `window.api` stub'ıyla (1024×768, sidebar ikon modunda): header'da "Model indirilmedi" → tıklayınca Ayarlar doğrudan Transcription Modeli bölümünde açılıyor; indirme sürerken header'da ince çubuk + "%35" (Home'daki ModelCard da %35); hata durumunda kırmızı "İndirme başarısız"; hazırken header'da gösterge yok. Ayarlar'da Sil'in tooltip'i üç durumda doğru ("Silinecek model yok.", "İndirme sürerken model silinemez.", "Metne dökme sürerken ya da sırada Meeting varken model silinemez."); kuyruk boşken Sil → onay dialog'u → onaylayınca `model.remove` çağrıldı, satır "İndirilmedi" ve header "Model indirilmedi" oldu.
- **Doğrulanmayan:** Gerçek Electron: diskten silmenin gerçek `userData/models` klasöründe görülmesi (servis testleri geçici klasörde gerçek dosyalarla doğruluyor, IPC bağlantısı denenmedi), silme sonrası "Metne dök" → `forceAsk` sorusu → indirip Transcribe'ın sürmesi, "Finder'da göster"in Finder'ı açması, gerçek indirme sırasında göstergenin ilerlemesi, header'daki göstergenin `app-no-drag` ile tıklanabilir olması.
- **Ticket'ta yazmayan kararlar:** (1) Diskte hiçbir şey yokken (missing, `partialBytes: 0`) Sil de devre dışı ("Silinecek model yok."); main'de ise olmayan modeli silmek hata değil (idempotent). Yarım indirme ya da hatalı indirmenin `.part`'ı Sil ile temizlenebilir. (2) Red mesajları tek yerde: `MODEL_REMOVE_BLOCKED` (`src/shared/model.ts`); main hata mesajında, renderer tooltip'te aynı metni kullanır. (3) Gösterge `missing` iken "Şimdilik atla" denmiş olsa da görünür (spec: eksikse "Model indirilmedi"). (4) Ayarlar'ı bölümle açma API'si: `SettingsDialogApi.openAt(section)`; ⌘, ve footer son bakılan bölümde açmaya devam eder. (5) `TRANSCRIPTION_MODEL_INFO.displayName = 'Whisper large-v3-turbo (q5_0)'` eklendi (satır adı). (6) Header göstergesinin `title`'ı "Ayarlar > Transcription Modeli" (oklardaki gibi tooltip yerine `title`).

Denenecekler (gerçek Electron, macOS):

- [ ] Model hazırken Ayarlar > Transcription Modeli > Sil → onay → `~/Library/Application Support/<app>/models/` altında model dosyası ve `.part` kalmıyor; satır ve header "Model indirilmedi" oluyor.
- [ ] Silmeden sonra bir Closed Meeting'de "Metne dök" → indirme sorusu (daha önce "Şimdilik atla" denmiş olsa da) açılıyor; İndir → indirme bitince Transcribe kendiliğinden başlıyor.
- [ ] Bir Meeting metne dökülürken (ya da sıradayken) ve indirme sürerken Sil devre dışı ve tooltip nedeni gösteriyor.
- [ ] Header'daki gösterge tıklanabiliyor (pencereyi sürüklemiyor), indirme sırasında yüzde ilerliyor; "Finder'da göster" Finder'da modeli seçili açıyor.

Hepsi geçince ikinci ve üçüncü kabul kriteri işaretlenip `resolved` yapılır.
