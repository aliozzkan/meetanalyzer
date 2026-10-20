Status: ready-for-agent
Blocked by: 01

# Ayarlar modal'ı ve tema (Default Language dahil)

Spec: [../spec.md](../spec.md) → "Ayarlar modal'ı", "Sidebar > Alt alan", "Kısayollar"

Backlog 08'i (Default Language ayarı) kapsar.

## Yapılacaklar

- **Ayarlar dialog'u:** solunda bölüm menüsü; bölümler **Genel** ve **Hakkında** (Transcription Modeli bölümü issue 07'de). Sidebar footer'ında Ayarlar girişi, ⌘, kısayolu ve macOS uygulama menüsünde "Ayarlar…".
- **Genel > Default Language:** kalıcı ayar (Türkçe varsayılan). Ayar saklama yeri henüz yok: main tarafında basit bir ayar deposu (ör. `settings` key/value tablosu, yeni migration) ve IPC ekle. `MeetingList`'in sabit `DEFAULT_LANGUAGE`'ı yerine bu değer kullanılsın.
- **Tema:** Sistem/Açık/Koyu. `ThemeProvider` elle seçimi desteklesin (`localStorage`, varsayılan Sistem). Seçim değişince main'e IPC ile iletilip `nativeTheme.themeSource` güncellensin. Footer'da ikon butonu + 3 seçenekli menü; Genel'deki Tema seçimiyle aynı değeri paylaşır.
- **Hakkında:** uygulama sürümü, whisper sürümü, "Veri klasörünü Finder'da göster".
- Recording sürerken dialog güvenle açılıp kapanır.

## Kabul kriterleri

- [ ] Default Language değiştirilip uygulama yeniden başlatılınca korunur; Yeni Meeting bu dille önerilir.
- [ ] Tema footer menüsünden ve Ayarlar'dan değişince diğeri de güncellenir; yeniden başlatınca korunur; "Sistem"de OS temasını izler.
- [ ] Koyu temada native menüler/scrollbar'lar uyum sağlar (`nativeTheme`).
- [ ] ⌘, ve "Ayarlar…" menüsü dialog'u açar.
- [x] `localStorage` erişilemese de uygulama Sistem teması ile açılır.

## Comments

**2026-10-20 (implementasyon + review sonrası):**

- **Doğrulama sınırı:** Renderer, tarayıcı pane'inde geçici bir `window.api` stub'ıyla denendi: footer tema menüsü ↔ Ayarlar > Genel senkronu, temanın sayfa yenilemede korunması, Default Language'ın Home'daki seçiciye yansıması, Hakkında bölümü. Main tarafı (`nativeTheme`, uygulama menüsü ve ⌘,, Default Language'ın gerçek yeniden başlatmada korunması, veri klasörünü açma) gerçek Electron penceresinde **denenmedi**. `localStorage` kriteri birim testiyle (`theme.test.ts`) kapanır.
- **Ayar deposu:** `settings` key/value tablosu (migration 3) ve `createSettingsService`. Okunan değer de `LANGUAGES` ile daraltılır; tanınmayan değer Türkçe'ye düşer.
- **Tema:** `localStorage`'da (`theme`), main'e `settings:set-theme` ile iletilir ve `nativeTheme.themeSource` güncellenir. Electron'da bu, renderer'ın `prefers-color-scheme` sorgusunu da seçilen temaya çeker; `dark` sınıfı `isDarkTheme(tercih, sistem)` ile hesaplanır.
- **⌘, pencere kapalıyken (macOS):** Pencere yeniden açılır. İstek main'de saklanır, yeni renderer açılışta `app:take-pending-settings` ile sorar. Yeni pencereye mesaj göndermek, renderer dinlemeye başlamadan gidebileceği için kullanılmadı.
- **Menü:** Electron'un varsayılan menüsü özel şablonla değişti; macOS'ta uygulama menüsüne "Ayarlar…" eklendi. Windows/Linux'ta Ctrl+, çalışsın diye "Ayarlar…" File menüsünde. Varsayılan Help menüsü (Electron bağlantıları) düştü.
- **whisper sürümü:** Hakkında ekranı çalışan binary'yi sorgulamaz; `WHISPER_CPP_VERSION` (`src/main/config.ts`) gösterilir. `version.test.ts`, değerin `build-whisper.sh` içindeki `WHISPER_CPP_TAG` ile aynı olduğunu denetler.
- **Kapsam dışı bırakılanlar (review):** `theme.ts` ile `use-sidebar-open.ts`'teki try/catch'li `localStorage` okuma/yazma benzer. Üçüncü kullanım gelene kadar ortak yardımcıya çıkarılmadı.
