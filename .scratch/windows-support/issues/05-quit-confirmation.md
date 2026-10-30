Status: resolved

# Recording ya da Transcription sürerken kapatma onayı

Spec: [../spec.md](../spec.md) → "Kapatma" (kullanıcı akışı), "Kapatma onayı"

Her iki platformda geçerlidir.

## Yapılacaklar

- Main'de saf bir karar fonksiyonu: aktif Recording var mı, çalışan Transcription var mı bilgisini alır; kapatmak bir şey kaybettirmiyorsa `null`, kaybettiriyorsa onay metnini döndürür. Metin durumdan kurulur: yalnızca Recording, yalnızca Transcription ya da ikisi.
- Recording servisi ve Transcription kuyruğu bu bilgiyi okumak için gereken küçük sorguları sunar (yoksa eklenir).
- `before-quit` (her platform): fonksiyon `null` değilse kapanış durdurulur, "Kapat" / "Vazgeç" seçenekli bir mesaj kutusu gösterilir. "Kapat" seçilirse bir bayrak kurulur ve çıkış yeniden başlatılır; bayrak varken tekrar sorulmaz.
- Windows'ta ana pencerenin `close` olayı aynı akışı kullanır. Böylece X ve Alt+F4 de sorulur ve onaydan sonra `before-quit` ikinci kez sormaz.
- macOS'ta pencereyi kapatmak uygulamayı kapatmaz ve Transcription sürer; mikrofon yakalama renderer'da olduğu için Recording ise durur. Bu yüzden macOS'ta pencere kapatılırken yalnızca Recording sürüyorsa sorulur.
- Onay sonrası kapanış bugünkü gibidir: `will-quit` Recording'leri durdurur, Transcription'ı kapatır.

## Kabul kriterleri

- [x] Karar fonksiyonu için birim testleri: hiçbir şey sürmüyor, yalnızca Recording, yalnızca Transcription, ikisi birden.
- [x] Windows'ta Recording sürerken X ve Alt+F4 onay sorar; "Vazgeç" uygulamayı açık bırakır ve Recording sürer.
- [ ] macOS'ta Transcription sürerken Cmd+Q onay sorar; pencereyi kapatmak yalnızca Recording sürerken sorar.
- [x] Hiçbir şey sürmüyorken kapatma sorulmadan gerçekleşir.
- [x] "Kapat" seçildikten sonra tek bir onayla uygulama kapanır; açılışta Meeting'ler bugünkü kurallara göre toparlanır.

## Comments

**2026-10-30:** Uygulandı; Windows 11'de `pnpm dev` ile kullanıcı doğruladı.

- `src/main/app/quit-guard.ts`: `quitWarning(state)` metni kurar; `createQuitGuard(confirm).allow(state, forQuit)` gerekirse sorar. Çıkış bir kez onaylanınca aynı çıkışta tekrar sorulmaz; macOS'ta yalnızca pencere kapanırken verilen onay sonraki bir çıkışa sayılmaz. Testleri `quit-guard.test.ts`.
- `RecordingService.hasAnyActive()` eklendi (testli); Transcription için `hasPendingTranscription(getStatus())` kullanılır, sıradaki Meeting'ler de iptal olacağı için sayılır.
- `index.ts`: `before-quit` her platformda; ana pencerenin `close` olayı Windows/Linux'ta çıkış olarak, macOS'ta yalnızca Recording için. Onay penceresi "Kapat" / "Vazgeç", varsayılan "Vazgeç".
- Windows'ta Ctrl+Q kısayolu yok: Electron'un "Çıkış" menü öğesinin Windows'ta varsayılan kısayolu bulunmuyor; çıkış X ve Alt+F4 ile yapılır.
- macOS kriteri bir Mac'te doğrulanmalı.
