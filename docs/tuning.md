# Ayarlanabilir değerler

ADR gerektirmeyen ama "neden bu değer?" sorusunun cevabı kaybolmaması gereken sabitler. Koddaki karşılıkları tek bir config modülünde durur ve her biri yorumla bu dokümana işaret eder. Bir değeri değiştirirken bu dosyayı da güncelle.

| Değer | Şu an | Neden | Nasıl yeniden ayarlanır |
| --- | --- | --- | --- |
| **Suspect Word eşiği** | Kelimenin en düşük token olasılığı `< 0.5` | Ortalama yerine minimum, "doğru başlayıp yanlış biten" Türkçe ek hatalarını yakalar. 0.5 başlangıç tahminidir. | Etiketli gerçek Türkçe ve İngilizce kayıtlarda, işaretlenen kelimelerden kaçının gerçekten yanlış olduğuna (precision) ve yanlışların kaçının işaretlendiğine (recall) bakarak. Kullanıcıya ayar olarak açılmaz. |
| **whisper thread sayısı** | Performans çekirdeklerinin yarısı (`hw.perflevel0.physicalcpu / 2`, en az 2) | Eşzamanlı Recording ve toplantı uygulamasına yer bırakmak. Çalışan process'in thread sayısı sonradan değiştirilemez. | Recording + Transcription aynı anda çalışırken ses kesintisi ve toplantı uygulamasında takılma var mı diye ölçerek. |
| **whisper process önceliği** | `os.setPriority(pid, 10)` | Aynı sebep: OS zamanlayıcısında Recording ve toplantı uygulaması önde olsun. | Aynı ölçüm. |
| **PCM parça süresi** | 5 sn | Çökmede en fazla ~5 sn ses kaybı; IPC trafiği düşük kalır. | Kayıp toleransı ile IPC sıklığı arasında denge. |
| **Ses formatı** | 16 kHz, mono, 16-bit PCM WAV | whisper.cpp'nin doğrudan istediği format (bkz. ADR-0003). | Değiştirilmez; whisper gereksinimi. |
| **VAD** | Açık, whisper.cpp yerleşik Silero VAD (`--vad`), varsayılan eşik | Whisper sessizlikte metin uydurur (ör. "Altyazı M.K."); bu uydurmalar yüksek güvenli olduğu için Suspect Word olarak işaretlenmez. | Konuşma başlangıçları kırpılıyorsa eşik düşürülür; uydurma devam ediyorsa yükseltilir. |
| **Transcription modeli** | `ggml-large-v3-turbo-q5_0.bin` (~550 MB) | Türkçe kalitesi büyük modellerde belirgin şekilde iyi; turbo, medium'dan hızlı. | Kalite/hız ölçümüyle. Zayıf makineler için `small` fallback backlog'da. |
| **whisper.cpp sürümü** | `v1.9.5` (commit `d1be6fde11ac6e0407606b4e42fe72d34add8037`) | `--vad` ve `-ojf` destekli en güncel kararlı sürüm. Tag annotated olduğu için script, tag'in gösterdiği commit'i doğrular. | `scripts/build-whisper.sh` içindeki tag ve commit birlikte güncellenir; ardından `pnpm build:whisper` ve kısa bir Transcription duman testi. |
| **whisper derleme ayarları** | Metal + gömülü Metal kütüphanesi, statik, `GGML_NATIVE=OFF`, macOS 13.0 | `NATIVE=OFF` derleyen makinenin CPU komutlarının binary'ye gömülmesini önler (yeni M-serisinde derlenip eski M1'de çalışmama riski). Ağır iş Metal'de olduğundan CPU yolunun hızı belirleyici değil. | Script'teki cmake bayrakları. Deployment target Electron'un desteklediği en düşük macOS ile uyumlu tutulmalı. |
| **VAD modeli** | `ggml-silero-v6.2.0.bin` (865 KB), HF `ggml-org/whisper-vad` revision `9ffd54a1e1ee413ddf265af9913beaf518d1639b`, SHA-256 `2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987` | whisper.cpp v1.9.5 README'sinin önerdiği Silero sürümü. Uygulamaya gömülür. | Script'teki sabitler ve `src/main/whisper/paths.ts` içindeki dosya adı birlikte güncellenir. |
| **Model kaynağı** | Hugging Face `ggerganov/whisper.cpp`, sabit commit revision | Dosya habersizce değişemez. | Revision ve SHA-256 birlikte güncellenir. **Değerler ilk implementasyonda doldurulacak.** |
| **Model SHA-256** | _implementasyonda doldurulacak_ | İndirme bütünlüğü. | Revision ile birlikte. |
| **Model indirme öncesi boş alan** | En az 1 GB | Model + geçici dosya + pay. | Model boyutu değişirse. |
| **Suspect Word dinleme penceresi** | Kelimenin 2 sn öncesinden 2 sn sonrasına | Yanlış duymayı çözmek için bağlam gerekir. | Kullanıcı geri bildirimiyle. |
| **Sessiz mikrofon uyarısı** | 10 sn tam sessizlik | Sessize alınmış veya yanlış mikrofonu erken yakalamak; doğal duraklamalarda uyarmamak. | Yanlış alarm sıklığına göre. |
| **Varsayılan Language** | Türkçe (`DEFAULT_LANGUAGE`, `src/shared/meeting.ts`) | Default Language ayarı henüz yok (backlog 08). Renderer ile paylaşıldığı için config modülünde değil, `src/shared/`'tadır. | Default Language ayarı gelince kalkar. |
