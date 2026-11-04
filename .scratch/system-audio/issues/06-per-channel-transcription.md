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

## Uygulama notu

Kod tamamlandı, testler henüz çalıştırılmadı ([test-checklist.md](../test-checklist.md)). Kabul kriterleri testten sonra işaretlenecek.

- Migration 6: `segments.channel` (`'mic' | 'system'`, mevcut satırlar `'mic'`). Segment numaraları Recording içinde sürer (`UNIQUE (recording_id, seq)` korunur): ikinci kanalın segmentleri birincinin son numarasından devam eder.
- `transcribeRecording` hâlâ Recording başına çağrılır (kuyruk arayüzü değişmedi); içeride `transcribed_at`'i boş kanallar sırayla (`mic`, `system`) işlenir, her kanal kendi transaction'ında yazılır. Tüm kanallar bitince `recordings.transcribed_at` (= "Recording tamam") set edilir.
- Hata/iptal/kapanma: biten kanallar korunur; yeniden başlatmada yalnızca kalanlar işlenir. Ses içermeyen kanal whisper çalışmadan sıfır segmentle tamamlanır.
- Kuyruk ilerlemesi: Recording ağırlığı = işlenecek kanalların toplam süresi; Recording içi ilerleme kanal sayısına eşit bölünür.
- `word-audio`: kelimenin segment kanalına göre `mic.wav` ya da `system.wav`.
