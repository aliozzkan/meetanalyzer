# Meetanalyzing

Kullanıcının katıldığı online toplantıları kaydeden, metne döken, kullanıcıya yalnızca şüpheli kelimeleri düzelttiren ve onaylanan metni analiz için backend'e gönderen masaüstü uygulaması.

## Language

**Meeting**:
Kullanıcının katıldığı bir online toplantının uygulamadaki karşılığı; Recording'leri, Transcript'i ve Analysis'i bir arada tutar. Recording başlatılırken açık Meeting yoksa otomatik oluşur.
_Avoid_: Meet, call, görüşme

**Title**:
Kullanıcının bir Meeting'e verdiği, isteğe bağlı ve yalnızca lokalde tutulan ad (en fazla 120 karakter, baştaki/sondaki boşluklar kırpılır). Boşsa arayüz Meeting'i tarih/saatiyle gösterir. Meeting'in her durumunda, Approved'dan sonra da değiştirilebilir; Approved Transcript'in değişmezliği Title'ı kapsamaz. Analysis Request ile backend'e gönderilmez.
_Avoid_: Name, başlık (arayüz metni dışında), subject

**Closed Meeting**:
Toplantı bittiği için kapatılmış, Transcription'ı henüz başlatılmamış Meeting; artık yeni Recording eklenemez. En az bir Recording'i olmayan Meeting kapatılamaz, silinir.
_Avoid_: Finished meeting, ended meeting

**Language**:
Bir Meeting'in konuşulan dili. Transcription bu dile göre çalışır; Meeting başlatılırken seçilir. Şimdilik Turkish ve English desteklenir.
_Avoid_: Locale, dil seçeneği

**Default Language**:
Kullanıcının ayarlarda seçtiği, her yeni Meeting'in Language'ı olarak önerilen dil.
_Avoid_: Preferred language

**Recording**:
Bir Meeting sırasında kullanıcının başlatıp bitirdiği ses kaydı. Bir Meeting'in birden çok Recording'i olabilir.
_Avoid_: Record (isim olarak), kayıt oturumu

**Transcription**:
Bir Meeting'in Recording'lerinin cihaz üzerinde metne dökülmesi işlemi. Toplantı bittikten sonra kullanıcı tarafından elle başlatılır; kendiliğinden başlamaz.
_Avoid_: Transcribe (isim olarak)

**Transcription Queue**:
Transcription'ı başlatılmış Meeting'lerin sırayla işlendiği kuyruk; aynı anda yalnızca bir Meeting'in Transcription'ı çalışır, diğerleri sırada bekler.
_Avoid_: İş kuyruğu, job queue

**Transcribing**:
Meeting durumu: Transcription başlatıldı; Meeting Transcription Queue'da sırada bekliyor ya da işleniyor.
_Avoid_: Processing, converting

**Transcribed**:
Meeting durumu: Transcript hazır; kullanıcı Suspect Word'lere Correction yapabilir ve Transcript'i onaylayabilir.
_Avoid_: Ready, review

**Transcription Model**:
Transcription'ın cihaz üzerinde konuşmayı metne dökmek için kullandığı, ilk kullanımda kullanıcı onayıyla indirilen model dosyası. Recording için gerekmez.
_Avoid_: Whisper dosyası, ses modeli

**Transcript**:
Transcription'ın ürettiği, bir Meeting'e ait tek metin; Meeting'in tüm Recording'lerini kapsar.
_Avoid_: Transcribe (isim olarak), döküm

**Suspect Word**:
Transcription'ın düşük güvenle ürettiği, yanlış duyulmuş olma ihtimali olan Transcript kelimesi.
_Avoid_: Typo, hatalı kelime, yazım hatası

**Correction**:
Kullanıcının tek bir Suspect Word'ün yerine yazdığı metin; birden çok kelime içerebilir ya da boş olabilir ama komşu kelimelere uzanmaz. Transcript'in geri kalanı kullanıcı tarafından düzenlenemez.
_Avoid_: Edit, fix

**Approved Transcript**:
Kullanıcının Suspect Word'leri gözden geçirip onayladığı, analize gönderilebilir Transcript. Onaydan sonra değişmez ve Meeting'in Recording sesleri silinir; düzeltilmemiş Suspect Word'ler olduğu gibi kalır.
_Avoid_: Final transcript, confirmed transcript

**Analysis**:
Backend'deki modelin bir Approved Transcript üzerinden ürettiği toplantı verimliliği değerlendirmesi. Bir Meeting için en fazla bir başarılı Analysis vardır ve her başarılı Analysis kullanıcıya gösterilir.
_Avoid_: Report, sonuç

**Analysis Request**:
Approved Transcript'in analiz için backend'e gönderilmesi. Send Failed ya da Analysis Errored ile sonuçlanan bir Analysis Request hak tüketmez; kullanıcı yeniden başlatabilir (Retry Analysis).
_Avoid_: Submit, upload

**Awaiting Analysis**:
Meeting durumu: Analysis Request gönderildi, Analysis henüz tamamlanmadı.
_Avoid_: Pending, processing

**Send Failed**:
Meeting durumu: Analysis Request backend'e ulaştırılamadı (Analiz gönderilemedi); kullanıcı Retry Analysis yapabilir.
_Avoid_: Upload failed, network error

**Analysis Errored**:
Meeting durumu: Analysis Request backend'e ulaştı ama analiz sırasında hata oluştu; kullanıcı Retry Analysis yapabilir.
_Avoid_: Analysis Failed, processing error

**Completed**:
Meeting durumu: Analysis başarıyla tamamlandı ve kullanıcı tarafından görüntülenebilir.
_Avoid_: Done, finished
