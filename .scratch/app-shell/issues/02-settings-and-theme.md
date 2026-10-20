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
- [ ] `localStorage` erişilemese de uygulama Sistem teması ile açılır.
