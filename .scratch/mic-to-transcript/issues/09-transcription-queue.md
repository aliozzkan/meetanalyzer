Status: ready-for-agent
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

- [ ] İki Meeting için Transcribe'a basılınca ikincisi "Sırada" görünür ve birincisi bitince başlar.
- [ ] Transcription sürerken yeni Meeting'de Recording alınabilir; kayıtta kesinti olmaz.
- [ ] Transcription sırasında uygulama kapatılıp açılınca Meeting Closed'dadır; yeniden başlatmada yalnızca kalan Recording'ler işlenir.
- [ ] Kuyruk çalışırken `pmset -g assertions` assertion'ı gösterir.
- [ ] Kuyruk mantığı için (runner mock'lanarak) birim testleri var.
