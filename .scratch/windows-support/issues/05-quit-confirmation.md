Status: ready-for-agent

# Recording ya da Transcription sürerken kapatma onayı

Spec: [../spec.md](../spec.md) → "Kapatma" (kullanıcı akışı), "Kapatma onayı"

Her iki platformda geçerlidir.

## Yapılacaklar

- Main'de saf bir karar fonksiyonu: aktif Recording var mı, çalışan Transcription var mı bilgisini alır; kapatmak bir şey kaybettirmiyorsa `null`, kaybettiriyorsa onay metnini döndürür. Metin durumdan kurulur: yalnızca Recording, yalnızca Transcription ya da ikisi.
- Recording servisi ve Transcription kuyruğu bu bilgiyi okumak için gereken küçük sorguları sunar (yoksa eklenir).
- `before-quit` (her platform): fonksiyon `null` değilse kapanış durdurulur, "Kapat" / "Vazgeç" seçenekli bir mesaj kutusu gösterilir. "Kapat" seçilirse bir bayrak kurulur ve çıkış yeniden başlatılır; bayrak varken tekrar sorulmaz.
- Windows'ta ana pencerenin `close` olayı aynı akışı kullanır. Böylece X ve Alt+F4 de sorulur ve onaydan sonra `before-quit` ikinci kez sormaz.
- macOS'ta pencereyi kapatmak sorulmaz (uygulama yaşamaya devam eder, Recording sürer).
- Onay sonrası kapanış bugünkü gibidir: `will-quit` Recording'leri durdurur, Transcription'ı kapatır.

## Kabul kriterleri

- [ ] Karar fonksiyonu için birim testleri: hiçbir şey sürmüyor, yalnızca Recording, yalnızca Transcription, ikisi birden.
- [ ] Windows'ta Recording sürerken X, Alt+F4 ve Ctrl+Q onay sorar; "Vazgeç" uygulamayı açık bırakır ve Recording sürer.
- [ ] macOS'ta Transcription sürerken Cmd+Q onay sorar; pencereyi kapatmak sormaz.
- [ ] Hiçbir şey sürmüyorken kapatma sorulmadan gerçekleşir.
- [ ] "Kapat" seçildikten sonra tek bir onayla uygulama kapanır; açılışta Meeting'ler bugünkü kurallara göre toparlanır.
