Status: resolved
Blocked by: 02, 05, 07, 08

# Transcription Queue ve Closed → Transcribing → Transcribed

Spec: [../spec.md](../spec.md) → "4. Transcription", "Çökme ve kapanma sonrası toparlanma"

## Yapılacaklar

- "Transcribe" (yalnızca `closed` Meeting'de): model yoksa issue 07'deki onay akışı; varsa Meeting `transcribing` olur ve `transcription_queue`'ya eklenir.
- Tek işçi, FIFO: sıradaki Meeting'in `transcribed_at`'i boş Recording'lerini `seq` sırasıyla runner'a verir. Hepsi bitince Meeting `transcribed` olur.
- Hata → Meeting `last_error` ile `closed`'a döner, kuyruktan çıkar; tamamlanan Recording'lerin sonuçları kalır.
- Başka bir Meeting'de Recording sürerken kuyruk durmaz.
- Kuyruk çalışırken power modülünde `transcription` alınır, kuyruk boşalınca bırakılır.
- Silinen Meeting kuyruktan çıkarılır; işleniyorsa runner iptal edilir.
- Açılışta: `transcribing` Meeting'ler `closed`'a döner ve kuyruk temizlenir.
- UI: "Sırada" / işleniyor + yüzde; Transcribing sırasında "Mac'in kapağını kapatırsanız işlem duraklar" uyarısı; Closed'da son hata mesajı.

## Kabul kriterleri

- [x] İki Meeting için Transcribe'a basılınca ikincisi "Sırada" görünür ve birincisi bitince başlar.
- [x] Transcription sürerken yeni Meeting'de Recording alınabilir; kayıtta kesinti olmaz.
- [x] Transcription sırasında uygulama kapatılıp açılınca Meeting Closed'dadır; yeniden başlatmada yalnızca kalan Recording'ler işlenir.
- [x] Kuyruk çalışırken `pmset -g assertions` assertion'ı gösterir.
- [x] Kuyruk mantığı için (runner mock'lanarak) birim testleri var.

## Comments

**2026-10-11 (issue 02 review'undan):**
- `meetings.remove` kuyrukta ya da işlenen Meeting'i DB cascade ile siliyor ama çalışan whisper process'inden ve bellekteki kuyruktan haberi yok. Bu issue silme sırasında runner'ı iptal etmeli ve kuyruğu güncellemeli.
- `transition(id, to)` hata mesajı almıyor; `Transcribing → Closed` geçişinde `meetings.last_error` yazılabilmesi için opsiyonel bir `lastError` parametresi eklenmeli (test ile).
- `transcription_queue` sırası `ORDER BY enqueued_at, rowid` ile okunmalı (issue 01 notu).

**2026-10-11 (issue 06'dan):** Metal'in ilk çalıştırma derlemesi (~46 sn) bu kuyruğun "işleniyor" durumunda ilerleme yüzdesi olmadan görünebilir; ayrıntı issue 08 notunda.

**2026-10-11 (issue 05'ten):** Güç modülü hazır: `createPowerGuard(...)` ile `power.acquire('transcription')` / `power.release('transcription')` (`src/main/power/power-guard.ts`). Kuyruk çalışmaya başlayınca alın, kuyruk boşalınca bırakın; Recording'in engeli (`recording`) ayrı bir sebeptir ve birbirini etkilemez. `index.ts`'te oluşturulan `power` örneği kuyruğa da geçirilmeli. Doğrulama: `pmset -g` → `sleep prevented by … Electron`.

**2026-10-11 (issue 07'den):** "Transcribe" model `ready` değilken model sorusunu yeniden göstermeli; `useModel` ve `ModelCard` hazır, ancak kart "Şimdilik atla" sonrası `localStorage` bayrağıyla gizli kalır: Transcribe anında bayrak yok sayılmalı (ör. karta `forceAsk` ekleyin).

**2026-10-11 (issue 08'den):** Hazır API: `transcribeRecording({ db, recordingsDir, recordingId, language, suspectThreshold, whisper: { cliPath, modelPath, vadModelPath, threads, nice }, onProgress, signal, now? })` (`src/main/transcription/transcribe-recording.ts`). Kuyruk Meeting'in `transcribed_at`'i boş Recording'lerini `seq` sırasıyla çağırmalı; her çağrı kendi transaction'ında yazar ve `AbortSignal` ile iptal edilir (iptalde DB'ye yazılmaz). `getWhisperPaths(...)` (`src/main/whisper/paths.ts`) + `getModelPath(...)` yolları verir; thread için `whisperThreads(performanceCoreCount())`, `WHISPER_NICE` config'te, eşik `SUSPECT_WORD_THRESHOLD`. Hata kodları: `cancelled`, `whisper-failed`, `whisper-missing`, `invalid-output`, `audio-missing`, `recording-not-found`, `already-transcribed`. Gerçek hız ~45x gerçek zaman; ilerleme yüzdesi çalıştırıcıdan gelir (6 dakikalık seste %14…%75 akışı gözlendi).

**2026-10-11 (issue 08 review'undan):** (1) Uygulama kapanırken (`will-quit`) çalışan whisper'ı `AbortSignal` ile iptal edin; aksi halde yetim kalır (çalıştırıcıda process grubu ya da `before-quit` kancası yok). (2) Metal'in ilk çalıştırma derlemesi (~46 sn) sırasında hiç ilerleme olayı gelmez; UI %0'da "ilk kullanım hazırlığı" gibi bir durumu bunu ayırt edebilmeli (çalıştırıcıda zaman aşımı yok, bilerek). (3) `transcribeRecording` ses içermeyen Recording'i whisper çalıştırmadan sıfır segmentle tamamlar, `ended_at` boşsa `recording-not-finished` verir; kuyruk bu kodları hata olarak tekrar denememeli.
