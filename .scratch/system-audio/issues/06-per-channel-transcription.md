Status: ready-for-agent
Blocked by: 04

# Kanal başına Transcription

Spec: [../spec.md](../spec.md) → "3. Transcription", "Veri"

## Yapılacaklar

- Migration: `segments`'e kanal (`channel`); mevcut segmentler `mic`.
- `transcribeRecording` → kanal başına çalışır (`transcribed_at`'i boş kanallar); her kanal kendi transaction'ında yazılır. Ses içermeyen kanal whisper çalıştırılmadan sıfır segmentle tamamlanır.
- `transcription-queue`: ilerleme kanal sayısına göre; hata sonrası yalnızca kalan kanallar. Meeting'in tüm kanalları bitince `transcribed`.
- Yalnızca `mic` kanalı olan Recording'ler tek kanallı işlenir.
- `word-audio`: kelimenin kendi kanalının dosyasından okur.

## Kabul kriterleri

- [ ] İki kanallı bir Recording için iki whisper çağrısı yapılır, segmentler kanallarıyla yazılır.
- [ ] Bir kanal bittikten sonra hata/kapanma olursa yeniden başlatmada yalnızca kalan kanal işlenir (test).
- [ ] Tek kanallı eski Recording'ler transcribe olur (test).
- [ ] Suspect Word dinletmesi kelimenin kendi kanalını çalar (test).
