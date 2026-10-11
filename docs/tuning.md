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
| **Model kaynağı** | Hugging Face `ggerganov/whisper.cpp`, sabit commit revision | Dosya habersizce değişemez. | Revision ve SHA-256 birlikte güncellenir. **Değerler ilk implementasyonda doldurulacak.** |
| **Model SHA-256** | _implementasyonda doldurulacak_ | İndirme bütünlüğü. | Revision ile birlikte. |
| **Model indirme öncesi boş alan** | En az 1 GB | Model + geçici dosya + pay. | Model boyutu değişirse. |
| **Suspect Word dinleme penceresi** | Kelimenin 2 sn öncesinden 2 sn sonrasına | Yanlış duymayı çözmek için bağlam gerekir. | Kullanıcı geri bildirimiyle. |
| **Sessiz mikrofon uyarısı** | 10 sn tam sessizlik | Sessize alınmış veya yanlış mikrofonu erken yakalamak; doğal duraklamalarda uyarmamak. | Yanlış alarm sıklığına göre. |
| **Varsayılan Language** | Türkçe | Default Language ayarı henüz yok (backlog). | Default Language ayarı gelince kalkar. |
