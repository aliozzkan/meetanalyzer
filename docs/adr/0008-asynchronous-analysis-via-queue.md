---
status: accepted
---
# Analysis asenkron çalışır: 202 + kuyruk + durum sorgulama

Backend, Analysis Request'i aldığında işi kuyruğa bırakır. API isteği `Idempotency-Key` ile doğrular, Analysis kaydını `Queued` olarak yazar, Service Bus'a `AnalysisRequested` mesajı koyar ve `202 Accepted` + `analysisId` döner. Ayrı bir analysis worker mesajı alır ve işi iki adımda yürütür. Birinci adımda Approved Transcript'i Azure AI Foundry'deki modele girdi olarak verir ve önceden tanımlı bir JSON şemasına dönüştürmesini ister (şema modelin çıktısını kısıtlar, structured output); worker çıktıyı şemaya karşı doğrular. İkinci adımda bu JSON üzerinde bizim yazdığımız deterministik algoritma verimlilik değerlendirmesini hesaplar; ham JSON ile skor birlikte kaydedilir. İstemci `GET /v1/analyses/{analysisId}` ile durumu sorgular (poll); `Completed` olunca skor JSON'unu çekip kendisi render eder.

Backend durumları istemcideki Meeting durumlarına şöyle karşılık gelir:

| Backend                  | Meeting durumu    |
| ------------------------ | ----------------- |
| `Queued`, `Processing`   | Awaiting Analysis |
| İstek backend'e ulaşmadı | Send Failed       |
| `Errored` (hata koduyla) | Analysis Errored  |
| `Completed`              | Completed         |

## Considered Options

- **İstek içinde senkron analiz**: model çağrısının süresi saniyelerden dakikalara uzar ve öngörülemez; zaman aşımı, retry ve kota (429) yönetimi istemciye ve HTTP bağlantısına yıkılır.
- **API process'i içinde arka plan görevi (kuyruksuz)**: process yeniden başlayınca iş kaybolur; ölçeklenme, retry ve dead-letter elle yazılır.
- **Push bildirimi (SignalR / Web PubSub / SSE)**: poll'dan daha hızlı sonuç verir, ama istemci ve altyapı karmaşıklığı artar. Faz 1'de poll yeterli; push faz 2'ye bırakıldı.

## Consequences

- İstemcinin mevcut Awaiting Analysis, Send Failed, Analysis Errored ve Retry Analysis durumları bu akışla birebir örtüşür; Send Failed ve Analysis Errored hak tüketmez.
- `Idempotency-Key` zorunludur ve istemci tarafından üretilir: yanıtı hiç görmemiş bir istemcinin yeniden denemesini ancak istemcinin verdiği kimlik tanıyabilir. Sunucu anahtarı kullanıcıya bağlar, istek içeriğinin hash'iyle birlikte saklar ve ilk isteğin `202` + `analysisId` yanıtını aynen saklar. Aynı anahtar farklı içerikle gelirse `422` döner; aynı anahtar ve içerikle gelen ikinci istek yeni Analysis üretmez.
- Idempotency'nin kaynağı Postgres'tir, `(user_id, idempotency_key)` üzerinde unique constraint ve bir Meeting için en fazla bir aktif ya da başarılı Analysis'i sağlayan ayrı bir kısıt vardır. Redis tekrar eden isteği veritabanına inmeden yakalayan hızlı yoldur; anahtar eviction'la ya da yeniden başlatmayla Redis'ten kaybolsa bile çift Analysis oluşmaz. Böylece "bir Meeting için en fazla bir başarılı Analysis" kuralı istemcinin doğru davranmasına bağlı kalmaz.
- Durum sorgusu Redis'te cache'lenir; poll yükü veritabanına binmez.
- Foundry kotası (429) dolarsa mesaj backoff ile yeniden denenir. Şemaya uymayan çıktıda en fazla 2 yeniden deneme yapılır, sonra Analysis `Errored` olur. Tekrarlayan hata mesajı dead-letter kuyruğuna düşer. İçerik filtresi engellerse ayrı bir hata koduyla `Errored` olur.
- Analysis kaydı şema sürümünü, prompt sürümünü ve skor algoritması sürümünü taşır. Ham JSON ile skor ayrı saklandığından algoritma değişince eski Analysis'ler modele yeniden gitmeden yeniden skorlanabilir.
- Model transcripti yapılandırılmış JSON'a çevirir, skoru kendi algoritmamız hesaplar. Bu yüzden skor tekrarlanabilirdir, algoritma sürümlenebilir ve skor için ek model maliyeti yoktur. Rapor backend'de arka planda üretilir, istemci skor JSON'unu çekip render eder.
- Worker, API'den bağımsız ölçeklenir (Container Apps + KEDA, kuyruk uzunluğuna göre). Kuyruk sözleşmesi dilden bağımsız olduğundan worker faz 2'de Go ile yeniden yazılabilir.
- Transcript analiz tamamlandıktan 30 gün sonra silinir; Analysis JSON'u ve skor kalır.

### İstemci tarafı: anahtarın saklanması

Anahtar, uygulama kapansa da yaşaması için yerel SQLite'ta tutulur. Her gönderim denemesinin kendi anahtarı olduğundan (Analysis Errored sonrası Retry Analysis yeni bir deneme açar) anahtar ayrı bir tabloda (örn. `analysis_attempts`) durur; tablo, mevcut migration'lara dokunmadan yeni bir sürüm olarak eklenir. Satır şunları taşır: `idempotency_key` (UUID, birincil anahtar), `meeting_id`, `payload_hash` (Approved Transcript onaydan sonra değişmediği için bir kez hesaplanır), `analysis_id` (backend `202` dönünce yazılır), `state` (`pending`, `accepted`, `send_failed`, `errored`, `completed`), `created_at`. Anahtar yalnızca bir tekilleştirme kimliği olduğundan düz bir sütunda durur, `safeStorage` gerekmez.

- Satır, istek gönderilmeden önce `pending` olarak yazılır. İstek sırasında uygulama kapanırsa açılışta `pending` satır bulunur ve aynı anahtarla yeniden gönderilir; bu, çift Analysis'i önler.
- **Send Failed**'de aynı anahtarla yeniden denenir: istemci isteğin ulaşıp ulaşmadığını (zaman aşımı) kesin bilemez.
- **Analysis Errored** sonrası Retry Analysis yeni bir deneme sayılır: yeni satır, yeni anahtar. Aynı anahtar kullanılsaydı sunucu ilk (hatalı) yanıtı döndürürdü.
- Bu tablo yalnızca lokaldir ve [meeting-lifecycle.md](../meeting-lifecycle.md)'deki "Send Failed yalnızca lokalde bulunur" kuralının kaynağıdır.
