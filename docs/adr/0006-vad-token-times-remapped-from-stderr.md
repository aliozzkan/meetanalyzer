---
status: accepted
---

# VAD açıkken kelime zamanları whisper'ın stderr'indeki eşleme tablosundan düzeltilir

whisper.cpp `--vad` ile konuşma segmentlerini sessizlikleri çıkarılmış tek bir sese birleştirir. `-ojf` çıktısında **segment** zamanları orijinal zaman çizgisine çevrilir ama **token** zamanları çevrilmez: sıkıştırılmış sesin zamanında kalır. 6 sn sessizlikle başlayan bir kayıtta ilk kelime `20 ms`'de, 13.8 sn'de başlayan ikinci cümle `3.1 sn`'de görünür. Kelime zamanları Suspect Word'ün çevresindeki sesi çalmak için kullanıldığından (issue 11) bu yanlış yeri çalar.

whisper.cpp her VAD segmentinin orijinal ve sıkıştırılmış zamanını stderr'e yazar (`vad_segment_info: orig_start … vad_start …`). Parser bu satırlardan whisper.cpp'nin kendi eşleme tablosunu (kaynaktaki `map_processed_to_original_time`) yeniden kurar ve token zamanlarını orijinal çizgiye çevirir. İki ek kural uygulanır: (1) bir kelimenin başlangıcı iki konuşma segmenti arasındaki boşluğa düşerse sonraki segmentin başına, bitişi boşluğa düşerse önceki segmentin sonuna çekilir (whisper'ın kendi segment zamanları da bu yüzden saniyelerce kayabilir: token zamanı VAD sınırından birkaç yüz ms önceye düşünce boşluğa doğrusal interpolasyon yapılır). Boşluk, segment sonundaki 0.1 sn'lik örtüşmeyi de kapsar: gerçek veride sonraki cümlenin ilk kelimesi sık sık VAD başlangıcından 100-200 ms önce damgalanır, onu önceki segmente eşlemek saniyeler kaydırır; (2) Segment zamanları whisper'ın değil kelimelerin zamanlarından türetilir.

## Considered Options

- **`--vad`'i kapatmak**: zamanlar doğru olurdu ama whisper sessizlikte metin uydurur (ADR-0002'nin sonuçları); reddedildi.
- **Sesi kendimiz VAD ile bölüp parça parça transcribe etmek**: kesin zaman verir ama çok sayıda whisper çağrısı ve model yükleme maliyeti demektir.
- **whisper.cpp'yi yamalamak**: sabitlenmiş sürümü bakım yüküne çevirir.
- **Segment içinde doğrusal ölçekleme**: segment birden çok konuşma bölümünü kapsadığında (sık) sessizlik toplamı kadar kayar; reddedildi.

## Consequences

- Parser'ın doğruluğu whisper.cpp'nin stderr biçimine bağlıdır. Örtüşme değeri whisper'a `--vad-samples-overlap` ile açıkça verilir (`WHISPER_VAD_SAMPLES_OVERLAP_S`), varsayılana güvenilmez; whisper.cpp sürümü güncellenirken eşleme, gerçek bir kayıtta whisper'ın kendi segment sınırlarıyla yeniden doğrulanmalıdır (`whisper-parser.test.ts` içindeki ölçüt testleri bunu otomatik yapar).
- Gerçek whisper çıktılarından alınan fixture'lar `src/main/transcription/fixtures/` altındadır.
