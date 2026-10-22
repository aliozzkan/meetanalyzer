# Meeting yaşam döngüsü

Bir Meeting'in baştan sona geçtiği durumları ve geçiş kurallarını anlatır. Terimler [GLOSSARY.md](../GLOSSARY.md) ile aynıdır.

Meeting'in durumu **tek bir sıralı durum alanıdır**. Closed ve Approved ayrı bayraklar değildir; böylece "kapalı ama onaylanmamış" gibi geçersiz kombinasyonlar oluşamaz.

## Akış

```
Recording ──► Closed ──► Transcribing ──► Transcribed ──► Approved ──► Awaiting Analysis ──► Completed
                 ▲            │                                          │    ▲
                 └── hata / ──┘                                          │    └── Retry Analysis ──┐
                     kapanma                                             ▼                         │
                                                                  Send Failed / Analysis Errored ──┘
```

| Durum                 | Anlamı                                                                      | Kullanıcının yapabildiği                                             |
| --------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Recording**         | Meeting açık, Recording alınıyor ya da yeni Recording eklenebilir.          | Recording başlat/durdur, Meeting'i kapat, Meeting'i sil              |
| **Closed**            | Toplantı bitti, yeni Recording eklenemez. Transcription henüz başlatılmadı. | Transcription'ı başlat, Meeting'i sil                                |
| **Transcribing**      | Meeting Transcription Queue'da; sırada bekliyor ("Sırada") ya da işleniyor. | Bekle, Meeting'i sil (işleniyorsa çalışan whisper iptal edilir)      |
| **Transcribed**       | Transcript hazır.                                                           | Suspect Word'lere Correction yap, Transcript'i onayla, Meeting'i sil |
| **Approved**          | Transcript onaylandı (Approved Transcript), artık değişmez.                 | Analiz düğmesine bas                                                 |
| **Awaiting Analysis** | Analysis Request gönderildi, Analysis tamamlanmadı.                         | Bekle                                                                |
| **Completed**         | Analysis başarıyla tamamlandı.                                              | Analysis'i görüntüle                                                 |
| **Send Failed**       | Analysis Request backend'e ulaşmadı.                                        | Retry Analysis                                                       |
| **Analysis Errored**  | Request ulaştı ama analiz sırasında hata oluştu.                            | Retry Analysis                                                       |

## Geçiş kuralları

- Aynı anda en fazla bir Meeting Recording durumunda olabilir.
- **Recording → Closed:** Kullanıcı toplantı bittiğinde Meeting'i kapatır. Dönüş yoktur. Hiç Recording'i olmayan Meeting kapatılamaz; silinir.
- **Closed → Transcribing:** Kullanıcı Transcription'ı elle başlatır; Meeting Transcription Queue'ya girer. Transcription toplantı sırasında kendiliğinden başlamaz, ama kullanıcı başlattıysa yeni bir Meeting'in Recording'i sürerken de arka planda devam eder.
- **Transcribing → Transcribed:** Meeting'in tüm Recording'leri transcribe edildi.
- **Transcribing → Closed:** Transcription hata verirse ya da uygulama Transcription sürerken kapanırsa. Hata durumunda hata mesajı Meeting'in `last_error` alanına yazılır ve Closed'da gösterilir; yeniden Transcribing'e girerken silinir. Tamamlanmış Recording'lerin transcript'leri korunur; yeniden başlatıldığında yalnızca kalanlar işlenir.
- **Transcribed → Approved:** Kullanıcı Transcript'i onaylar. Her Suspect Word'ün tek tek işaretlenmesi gerekmez; düzeltilmemiş Suspect Word varsa sayısıyla birlikte onay sorulur. Onay geri alınamaz; Approved Transcript dondurulur ve Recording sesleri silinir.
- **Silme:** Approved'dan önceki her durumda Meeting silinebilir; sesleri ve verisi tamamen kaldırılır. Approved ve sonrasında silme şimdilik yoktur.
- **Çökme:** Recording sırasında uygulama çökerse açılışta yarım kalan Recording son yazılan parçada bitmiş sayılır (WAV header'ı onarılır, süre ve bitiş zamanı yazılır; en fazla son ~5 sn kaybolur); hiç ses içermeyen Recording silinir. Meeting Recording durumunda kalır.
- **Approved → Awaiting Analysis:** Analysis Request backend'e başarıyla ulaşırsa.
- **Approved → Send Failed:** Analysis Request backend'e ulaşmazsa.
- **Awaiting Analysis → Completed:** Backend analizin tamamlandığını bildirir, sonuç çekilir.
- **Awaiting Analysis → Analysis Errored:** Backend analiz sırasında hata bildirir.
- **Send Failed / Analysis Errored → Awaiting Analysis:** Retry Analysis. Başarısız denemeler hak tüketmez; Approved Transcript aynı kalır.
- **Completed** son durumdur. Bir Meeting için en fazla bir başarılı Analysis vardır ve tekrar analiz yoktur.

## Backend ile ilişki

- Backend'e gönderim Awaiting Analysis'e geçişten sonra durum sorgulaması (polling) ile izlenir; tamamlandı yanıtı gelince sonuç ayrıca çekilir.
- Backend, Awaiting Analysis, Analysis Errored ve Completed durumlarının kaynağıdır. Send Failed istek hiç ulaşmadığı için yalnızca lokalde bulunur.
- Sayfa yenilenirse ya da uygulama yeniden açılırsa backend'den Awaiting Analysis'teki Meeting'ler çekilir ve bunlar için polling yeniden başlatılır.
- Meeting'in Title'ı Analysis Request payload'ına girmez; yalnızca lokaldir (müşteri/proje adı içerebilir). Bkz. GLOSSARY → Title.

## Açık noktalar

- Meeting yalnızca lokalde iken kullanıcıya gönderilecek bir Meeting modeline dönüştürülecek; bu paylaşım yaşam döngüsü buraya henüz dahil değil.
