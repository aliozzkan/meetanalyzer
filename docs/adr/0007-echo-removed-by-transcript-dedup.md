---
status: accepted
---

# Hoparlör yankısı ses seviyesinde değil, Transcript seviyesinde tekilleştirilerek temizlenir

Kulaklıksız bir toplantıda Others'ın sesi hem sistem sesi kanalına (temiz) hem hoparlörden mikrofona (gecikmeli, kısık) girer; iki kanal ayrı transcribe edildiği için aynı cümle Transcript'te iki kez, biri yanlışlıkla Self olarak görünür. Toplantı uygulamasının (Zoom, Meet) kendi yankı gidericisi yalnızca onun yakaladığı sesi temizler, bizim mikrofon akışımızı değil. İki kanal ayrı ayrı metne döküldükten sonra, bir mikrofon kelimesi belirli bir zaman penceresinde aynı yazılışla sistem sesi kanalında da geçiyorsa mikrofon kanalından atılır; pencere ve eşleşme kuralı `docs/tuning.md`'de tutulur. Kulaklıklı kullanımda hiçbir şey eşleşmez, yani zararsızdır.

## Considered Options

- **Sistem sesi kanalını referans alan ses seviyesinde yankı giderme (WebRTC AEC3)**: en temiz sonucu verir, ama whisper'dan sonra ikinci bir native sidecar'ın derlenip paketlenmesini ve iki akışın gecikmesinin hizalanmasını gerektirir. Tekilleştirme yetersiz kalırsa (prototipteki kulaklıksız kayıtla ölçülür) ileride buna geçilebilir; Transcription'dan önce `mic.wav`'ı temizleyen bir adım olarak eklenir, Transcript tarafı değişmez.
- **Enerji kapısı (sistem sesi konuşurken mikrofonu susturmak)**: kullanıcı Others'ın sözünü kestiğinde kendi sesi kaybolur; reddedildi.
- **Canlı yankı giderme (`getUserMedia({ echoCancellation: true })`)**: Chromium yalnızca kendi çaldığı sesi referans alır, başka uygulamanın çıkışını bilmez; üstelik transcription'ın istediği ham sesi bozar (ADR-0003 ile aynı gerekçe); reddedildi.

## Consequences

- Yankıyı whisper sistem sesinden farklı duyarsa (ör. tek harf farkı) mikrofon kanalında artık kelimeler Self olarak kalabilir; eşleşme kuralı gevşetildikçe bu azalır ama kullanıcının Others'ı aynı anda tekrarladığı gerçek sözleri silinme riski artar.
- Tekilleştirme Transcript'in parçası olduğundan atılan mikrofon kelimeleri `words` tablosunda kalır, yalnızca Transcript'e girmez; ham whisper çıktısının değişmezliği korunur.
