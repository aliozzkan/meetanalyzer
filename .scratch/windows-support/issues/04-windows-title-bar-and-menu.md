Status: resolved

# Windows'ta başlık çubuğu, menü ve uygulama kimliği

Spec: [../spec.md](../spec.md) → "Pencere" (kullanıcı akışı), "Pencere ve menü"

## Yapılacaklar

- `index.ts`: Windows'ta `titleBarStyle: 'hidden'` ve `titleBarOverlay` (yükseklik 44 px, renkler temadan). macOS ayarları değişmez.
- Tema değişince (açık/koyu/sistem) main `setTitleBarOverlay` ile renkleri günceller. Renkler header'ın arka planı ve ön plan rengiyle aynıdır.
- `app-header.tsx`: Windows'ta sağda pencere düğmeleri kadar boşluk (`env(titlebar-area-width)` ya da sabit genişlik); düğmeler ve tıklanabilir öğeler `no-drag` kalır. macOS'taki `pl-20` değişmez.
- Menü: Windows'ta şablon kurulmaya devam eder, görünmez; Ctrl+N ve Ctrl+, çalışır. `autoHideMenuBar` Alt tuşuyla menünün belirmesine yol açıyorsa kapatılır.
- `setAppUserModelId('com.meetanalyzing.app')`.
- Geri/ileri kısayolu (`use-history-navigation.ts`) bugün yalnızca `metaKey`e bakıyor; Windows'ta bu Windows tuşudur. Windows'ta Alt+← / Alt+→ kullanılır. Header'daki "Geri (⌘[)" / "İleri (⌘])" ipuçları platforma göre gösterilir.

## Kabul kriterleri

- [x] Windows'ta header pencerenin en üstündedir; küçült, büyüt ve kapat düğmeleri header'ın sağındadır ve header içeriğini örtmez.
- [x] Header'ın boş alanından pencere sürüklenir; çift tıklama pencereyi büyütür.
- [x] Açık ve koyu temada düğme renkleri header'a uyar; tema değişince hemen güncellenir.
- [x] Ctrl+N Yeni Meeting'i, Ctrl+, Ayarlar'ı açar.
- [x] Windows'ta Alt+← / Alt+→ geri ve ileri gider; header ipuçları Windows kısayolunu gösterir.
- [ ] Görev çubuğunda uygulama kendi adı ve ikonuyla gruplanır.
- [ ] macOS'ta pencere ve menü bugünkü gibidir.

## Comments

**2026-10-30:** Uygulandı; Windows 11'de `pnpm dev` ile kullanıcı doğruladı.

- `src/main/app/title-bar.ts`: `titleBarOptions(platform, dark)` macOS'ta bugünkü `hiddenInset` ayarını, Windows'ta `titleBarStyle: 'hidden'` + `titleBarOverlay`'i verir; overlay header'ın alt çizgisini örtmesin diye 43 px. `followThemeInTitleBar` `nativeTheme`'in `updated` olayında açık pencerelerin düğme renklerini günceller. Testleri `title-bar.test.ts`.
- Header: Windows'ta `app-drag` ve `app-window-controls-gap` (sağ boşluk `env(titlebar-area-*)` ile hesaplanır, tam ekranda kalkar).
- Kısayol: `historyShortcut` / `historyShortcutLabel` (`history-navigation.ts`, testli); macOS'ta ⌘[ / ⌘], diğerlerinde Alt+← / Alt+→.
- `setAppUserModelId('com.meetanalyzing.app')`.
- Kalan iki kriter: görev çubuğu gruplaması `pnpm dev`'de doğrulanamaz (pencereyi `electron.exe` açar), issue 06'daki NSIS paketiyle kontrol edilir. macOS kriteri bir Mac'te doğrulanmalı; macOS dalının kodu değişmedi, yalnızca `titleBarOptions`'a taşındı.
