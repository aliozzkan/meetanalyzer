# Mikrofon cihazı seçici

Bugün Recording, sistemin varsayılan mikrofonunu (`getUserMedia({ audio })`, `deviceId` verilmeden) açar. Bu dilimle kullanıcı Recording'in hangi mikrofonla alınacağını seçebilir; seçili cihaz bağlı değilse kayıt engellenmez, cihaz kayıt sırasında kopsa bile Recording sürer.

Terimler [GLOSSARY.md](../../GLOSSARY.md), durumlar [docs/meeting-lifecycle.md](../../docs/meeting-lifecycle.md), sayısal değerler [docs/tuning.md](../../docs/tuning.md) ile aynıdır. Kaynak not: [backlog 07](../backlog/issues/07-microphone-picker.md). İlgili kararlar: [ADR-0003](../../docs/adr/0003-pcm-wav-recording-without-ffmpeg.md) (PCM hattı).

## Mevcut durum

- `createMicSource` (`src/renderer/src/features/recording/mic-source.ts`) `getUserMedia`'yı cihaz belirtmeden çağırır; kısıtlar yalnızca `channelCount: 1` ve üç ses işleme kapatmasıdır.
- Mikrofon track'i `ended` olursa kaynak `onEnded` verir; `recorder-controller` Recording'i bitirir ve `interrupted: { meetingId, channel: 'mic' }` bırakır. Kullanıcı "Mikrofon kesildi" uyarısıyla "Yeni Recording başlat" der (`recording-controls.tsx`).
- `pcm-pipeline.ts` bir `MediaStream` alır ve sahipliğini devralır; `AudioContext` + `pcm-capture` worklet'i Recording boyunca tek bir kez kurulur. Worklet girişi yokken (`inputs[0][0]` yok) hiçbir örnek üretmez.
- Ayarlar main'de `settings` tablosunda anahtar/değer olarak tutulur (`settings-service.ts`: `default_language`, `system_audio_consent`); renderer'a IPC ile açılır. Tema ise yalnızca renderer'dadır.
- Ayarlar modal'ında bölümler: Genel (Tema, Default Language), Model, Hakkında.
- Yeni Meeting yalnızca Meeting oluşturur; Recording Meeting ekranındaki "Kaydı başlat" düğmesiyle (`recording-controls.tsx`) başlar.

## Kapsam

- Ayarlarda kalıcı **Mikrofon** seçimi: bağlı ses giriş cihazlarının listesi ve "Sistem varsayılanı".
- "Kaydı başlat" düğmesinin yanında, kayıt başlamadan önce cihazı değiştirmeye yarayan kısa seçim. Ayarlardaki ile aynı seçimi okur ve yazar.
- Seçili cihaz kayıt başlarken bağlı değilse sistem varsayılanıyla devam eder ve kullanıcıya haber verir.
- Recording sırasında kullanılan mikrofon kopunca Recording sürer, sistem varsayılanına geçilir.

## Kapsam dışı

- Seviye ölçer ya da "mikrofonu dene" önizlemesi. Cihaz doğruluğunu kullanıcı mevcut canlı "Sen" göstergesi ve sessiz mikrofon uyarısıyla anlar.
- Çıkış (hoparlör) cihazı seçimi. Sistem sesi çıkış cihazından bağımsız yakalanır (system-audio issue 01 ölçümü).
- Kayıt sırasında kullanıcının elle mikrofon değiştirmesi. Seçim yalnızca Recording başlamadan yapılır.
- Cihaz başına ayar (kazanç, ses işleme). Ses işleme kapalı kalır ([tuning.md](../../docs/tuning.md) → Mikrofon ses işleme).
- Sistem sesi kaynağı seçimi.

## Kullanıcı akışı

### Seçim

- Ayarlar › Genel'de "Mikrofon" alanı, bir açılır liste: "Sistem varsayılanı" ve işletim sisteminin bildirdiği her ses giriş cihazı, cihaz adıyla. Seçim hemen kaydedilir (Default Language gibi).
- Kayıt başlatılabilen her Meeting ekranında "Kaydı başlat" düğmesinin yanında aynı seçimi gösteren küçük bir seçici vardır. Burada yapılan değişiklik Ayarlardaki seçimdir; ikisi tek kaynaktan okunur.
- Recording sürerken seçici gösterilmez ya da devre dışıdır.
- Cihaz adları tarayıcı API'sinde yalnızca mikrofon izni verildikten sonra görünür. İzin henüz yoksa liste yalnızca "Sistem varsayılanı"nı gösterir ve altında izin verilince cihaz adlarının görüneceği söylenir. Liste cihaz takılıp çıkarıldıkça (`devicechange`) güncellenir.

### Seçili cihaz bağlı değil

- Kayıt başlarken kaydedilmiş cihaz bulunamazsa Recording yine başlar ve sistem varsayılanı kullanılır. Kullanıcıya bir kez bildirilir: "«X» bulunamadı, sistem varsayılanı mikrofon kullanıldı."
- Ayardaki seçim silinmez; cihaz geri takılınca bir sonraki Recording onu kullanır.
- Seçici, bağlı olmayan kaydedilmiş cihazı "X (bağlı değil)" olarak göstermeye devam eder; böylece kullanıcı neden varsayılana düşüldüğünü görür.

### Recording sırasında mikrofon koparsa

- Kullanılan mikrofon çıkarılır ya da kullanılamaz hale gelirse Recording **durmaz**. Kaynak sistem varsayılanı mikrofonu açar ve aynı mikrofon kanalına yazmaya devam eder. Kullanıcıya bir kez bildirilir: "Mikrofon kesildi, varsayılan mikrofona geçildi."
- Geçiş sırasında kanalın zaman çizgisi bozulmaz: kopma ile yeni cihazın açılması arasındaki süre sessizlikle doldurulur. Aksi halde `mic.wav`, `system.wav`'a göre kısalır ve iki kanalın zamanları (Transcript sıralaması, yankı tekilleştirme — ADR-0007) kayar. Zaman çizgisi `AudioContext` saatidir; worklet giriş yokken de sıfır örnek üretir.
- Varsayılan mikrofon da açılamazsa (cihaz yok) ya da izin geri alındıysa bugünkü davranış geçerlidir: Recording kendiliğinden biter, o ana kadarki kısım korunur, "Mikrofon kesildi" uyarısı ve "Yeni Recording başlat" çıkar.
- Geçişten sonra yeni cihaz da koparsa geçiş yeniden yapılır. Her geçiş yeni bir `ended` olayıyla başlar ve sistem varsayılanını açar; açılamazsa Recording biter, bu yüzden sonsuz döngü olmaz.
- Sessiz mikrofon uyarısının (10 sn) sayacı geçişte sıfırlanır: yeni cihaz sessizse kullanıcı geçişten 10 sn sonra uyarılır.

## Doğrulanmamış varsayımlar

Aşağıdakiler gerçek cihazla ölçülmeden kesin sayılmaz (issue 04). Sonuçlar bu bölüme yazılır.

- Seçili cihaz `deviceId: { exact }` ile açılırken cihaz yoksa `OverconstrainedError` verir ve başka bir hata türüyle karışmaz (izin reddi `NotAllowedError`'dur). Electron 45'te doğrulanacak.
- Kullanılan mikrofon çıkarılınca track `ended` olur ve bu bir `AudioContext` yeniden kurmadan yeni bir `MediaStreamSource`'a geçilerek karşılanabilir. Yeni kaynak aynı worklet düğümüne bağlanır.
- Bluetooth kulaklık takıldığında sistem varsayılan girişi değişir. "Sistem varsayılanı" seçiliyken açık akışın bu değişikliği izleyip izlemediği ya da `ended` olup olmadığı ölçülür. İzlemiyorsa (eski cihazda kalıyorsa) bu kapsamda ele alınmaz, ölçüm sonucu yazılır.
- Cihaz kimlikleri (`deviceId`) yeniden başlatmalar arasında kararlı mı. Kararlı değilse cihaz `label`'ıyla eşleştirme yedeği gerekir; bu yüzden ayarda hem `deviceId` hem `label` saklanır.
- Ayarlar modal'ı henüz hiç mikrofon izni verilmemişken açıldığında `enumerateDevices` etiket döndürmez.

## Açık sorular

- Kopma/geçiş anının kullanıcıya Transcript'te ya da Recording geçmişinde işaret olarak gösterilmesi gerekir mi? Bu dilimde yalnızca anlık bildirim vardır.

## Uygulama sırası

1. [Mikrofon seçimi ve kayıt](issues/01-microphone-selection.md): ayar, liste, `deviceId` ile açma, bağlı olmayan cihazda varsayılana düşme.
2. [Kayıt öncesi hızlı seçici](issues/02-quick-picker.md): "Kaydı başlat" yanındaki seçici.
3. [Kayıt sırasında varsayılana geçiş](issues/03-mid-recording-fallback.md): `ended` → yeni kaynak, sessizlik dolgusu.
4. [Gerçek cihazlarla doğrulama](issues/04-device-verification.md): insan işi.
