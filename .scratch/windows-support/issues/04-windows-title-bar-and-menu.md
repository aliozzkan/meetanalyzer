Status: ready-for-agent

# Windows'ta başlık çubuğu, menü ve uygulama kimliği

Spec: [../spec.md](../spec.md) → "Pencere" (kullanıcı akışı), "Pencere ve menü"

## Yapılacaklar

- `index.ts`: Windows'ta `titleBarStyle: 'hidden'` ve `titleBarOverlay` (yükseklik 44 px, renkler temadan). macOS ayarları değişmez.
- Tema değişince (açık/koyu/sistem) main `setTitleBarOverlay` ile renkleri günceller. Renkler header'ın arka planı ve ön plan rengiyle aynıdır.
- `app-header.tsx`: Windows'ta sağda pencere düğmeleri kadar boşluk (`env(titlebar-area-width)` ya da sabit genişlik); düğmeler ve tıklanabilir öğeler `no-drag` kalır. macOS'taki `pl-20` değişmez.
- Menü: Windows'ta şablon kurulmaya devam eder, görünmez; Ctrl+N ve Ctrl+, çalışır. `autoHideMenuBar` Alt tuşuyla menünün belirmesine yol açıyorsa kapatılır.
- `setAppUserModelId('com.meetanalyzing.app')`.

## Kabul kriterleri

- [ ] Windows'ta header pencerenin en üstündedir; küçült, büyüt ve kapat düğmeleri header'ın sağındadır ve header içeriğini örtmez.
- [ ] Header'ın boş alanından pencere sürüklenir; çift tıklama pencereyi büyütür.
- [ ] Açık ve koyu temada düğme renkleri header'a uyar; tema değişince hemen güncellenir.
- [ ] Ctrl+N Yeni Meeting'i, Ctrl+, Ayarlar'ı açar.
- [ ] Görev çubuğunda uygulama kendi adı ve ikonuyla gruplanır.
- [ ] macOS'ta pencere ve menü bugünkü gibidir.
