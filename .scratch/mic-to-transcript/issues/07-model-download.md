Status: ready-for-agent
Blocked by: 01

# Transcription modeli indirme ve onboarding

Spec: [../spec.md](../spec.md) → "1. Onboarding ve model"

## Yapılacaklar

- `ggml-large-v3-turbo-q5_0.bin` için Hugging Face `ggerganov/whisper.cpp` reposunda sabit bir commit revision'ı seç; URL'yi `.../resolve/<revision>/ggml-large-v3-turbo-q5_0.bin` biçiminde kur. Dosyayı indirip SHA-256'sını hesapla; revision ve hash'i config'e ve `docs/tuning.md`'ye yaz.
- Main'de indirici: `userData/models/<file>.part`'a yazar, HTTP Range ile kaldığı yerden devam eder, bitince SHA-256 doğrular ve atomik olarak yeniden adlandırır. Uyuşmazlıkta `.part` silinir ve hata döner.
- Başlamadan önce config'teki boş alan kontrolü.
- İndirme hiçbir zaman kendiliğinden başlamaz; yalnızca kullanıcı onayıyla başlar. Kullanıcının başlattığı bir indirme, sonradan Recording başlarsa durmaz.
- UI: ilk açılışta onboarding ekranı ("Transcription modeli (~550 MB) indirilsin mi?"), ilerleme çubuğu, yeniden deneme. Atlanırsa ilk "Transcribe" basışında aynı soru.

## Kabul kriterleri

- [x] İndirme yarıda kesilip uygulama yeniden açıldığında kaldığı yerden devam eder.
- [x] Bozuk dosya (hash uyuşmazlığı) kabul edilmez.
- [x] Yetersiz alanda indirme başlamaz ve kullanıcı uyarılır.
- [x] Hash doğrulama ve Range devam mantığı için birim testleri var.

## Comments

**2026-10-11:** Uygulandı.
- `src/main/model/model-downloader.ts` → `downloadModel(...)`: `<dest>.part`'a yazar, `Range` ile devam eder (206 ekler; 200 baştan; 416 `.part`'ı silip bir kez baştan dener), beklenenden büyük `.part`'ı siler, tam `.part` için ağa gitmez, boş alanı (`max(eşik, kalan)`) kontrol eder, erken biten/fazla gelen içeriği reddeder, hash'i doğrular ve yalnızca eşleşirse atomik `rename` eder; uyuşmazlıkta `.part` silinir. İptal `.part`'ı korur.
- `src/main/model/model-service.ts` → `createModelService(...)`: durum `missing | downloading | ready | error`; tek indirme, hatada yeniden denenebilir, `cancel` hata değil `missing`. Kurulu sayılma ölçütü beklenen boyutta dosya (her açılışta hash hesaplanmaz; dosya yalnızca doğrulanınca yerine alınır).
- Code-review sonrası düzeltmeler: iptal sonrası hemen `start` artık iptal bitince yeni indirmeyi başlatır (aynı `.part`'a iki yazıcı olmaz); akış beklenen boyutu aşarsa kesilir ve `Content-Length` farklıysa hiç indirmeden reddedilir; 206'da `Content-Range` istenen konumla uyuşmuyorsa `.part` geçersiz sayılıp baştan indirilir; hash doğrulaması iptal edilebilir (arayüz bu aşamada 'Doğrulanıyor…' gösterir); ağ hatası kullanıcıya anlaşılır Türkçe mesajla bildirilir, teknik ayrıntı loglanır; boyutlar ondalık MB (574 MB).
- Bilerek bırakılanlar: kurulu sayılma yalnızca boyuta bakar (aynı boyutta bozuk/elle konmuş dosya `ready` sayılır; issue 08 çalıştırıcısı başlamadan tek seferlik hash doğrulaması ekleyebilir); yönlendirmeler (HF → CDN) host/https allowlist'i yok, tek güven çıpası hash'tir; indirme sırasında uyku engeli yok; uygulama kapanırken indirme iptal edilmez (`.part` tutarlı kalır, bir sonraki açılışta devam).
- `app-model.ts` (üretim kablolaması, `getModelPath(modelsDir)`), `ipc.ts` (`model:get-state/start/cancel` + `model:state` olayı, ilerleme 250 ms'de bir), preload `api.model`, renderer `useModel` + `ModelCard`.
- Gerçek değerler config'te ve `docs/tuning.md`'de: revision `5359861c…` (HF main, 2024-10-29), SHA-256 `39422170…a7e2`, 574 041 195 bayt (547 MB).
- **Gerçek uygulamada ve gerçek HF'ten doğrulandı:** onboarding kartı görünüyor ve açılışta hiçbir indirme başlamıyor; "İndir" ile indirme başladı, süreç `SIGKILL` ile öldürüldü (359 MB, %62), yeniden açılışta durum `missing / partialBytes 359 326 952` ve kart "kaldığı yerden devam eder" dedi; devam eden indirme tam o bayttan başladı, tamamlandı, `.part` kalmadı; dosyanın SHA-256'sı uygulamadan bağımsız `shasum` ile de beklenenle eşleşti; yeniden açılışta anında `ready`.
- Birim testleri: 20 (indirici, gerçek yerel HTTP sunucusuna karşı: Range/206/200/416/404, kesilme, erken bitiş, fazla bayt, bozuk hash, yetersiz alan, iptal) + 6 (servis). 24 mutasyon yakalandı.
- **Gerçek ortamda denenmeyenler:** yetersiz disk alanı ve bozuk dosya (yalnızca birim testi; HF'ten bozuk dosya gelmesi simüle edilemedi).
- **Atlama kalıcılığı:** "Şimdilik atla" `localStorage`'a yazılır (arayüz tercihi); silinirse soru yeniden çıkar.
- **Issue 09 için:** "Transcribe"a basıldığında model `ready` değilse aynı soru yeniden gösterilmeli; `useModel().start()` ve `window.api.model` hazır. Kart şu an `localStorage` bayrağı yüzünden "atla"dan sonra gizli kalır; 09'da Transcribe anında zorla gösterme (ör. `forceAsk`) gerekecek.
- **Issue 08 için:** model yolu `getModelPath(join(userData, 'models'))`; çalıştırıcı başlamadan önce `model.getState().status === 'ready'` olmalı.
