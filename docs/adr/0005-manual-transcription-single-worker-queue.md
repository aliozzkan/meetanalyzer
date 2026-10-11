---
status: accepted
---

# Transcription elle başlatılır ve tek işçili bir kuyrukta çalışır

Transcription toplantı sırasında kendiliğinden çalışmaz; kullanıcı Meeting kapandıktan sonra elle başlatır. Böylece toplantı sırasında makine, kullanıcının haberi olmadan yüklenmez. Ancak kullanıcı başlattıysa, yeni bir Meeting'in Recording'i sürerken de arka planda devam eder: kullanıcı bunu bilerek göze almıştır. Aynı anda yalnızca bir whisper process'i çalışır; birden çok Meeting FIFO sırayla işlenir.

## Considered Options

- **Her Recording bittiğinde otomatik transcribe**: Meeting kapanınca bekleme kısalırdı, ama toplantı sırasında arka planda işlem yapılmaması tercih edildi.
- **Yeni Recording başlayınca Transcription'ı iptal etmek**: kullanıcının bilinçli başlattığı işi boşa çıkarır.
- **Paralel Transcription**: ikisi de yavaşlar ve bellek (turbo q5 ~1 GB+) katlanır; sıralı çalışma toplamda daha hızlıdır.

## Consequences

- whisper her zaman düşük öncelik ve sınırlı thread sayısıyla başlatılır ki eşzamanlı Recording ve toplantı uygulaması takılmasın.
- Transcription iki ayrı Meeting durumu (Transcribing, Transcribed) gerektirir; bkz. [meeting-lifecycle.md](../meeting-lifecycle.md).
