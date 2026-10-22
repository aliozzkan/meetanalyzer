Status: ready-for-agent
Blocked by: 01, 04

# Sidebar satır aksiyonları

Spec: [../spec.md](../spec.md) → "Sidebar > Meeting listesi"

## Yapılacaklar

- Satırda sağ tık `ContextMenu` ve hover'da beliren "⋯" butonu aynı menüyü açar: **Yeniden adlandır, Kapat, Metne dök, Sil**.
- Seçenekler mevcut `MeetingActions` durum kurallarını yeniden kullanır (kopyalama yok; ortak bir kural fonksiyonuna çıkar); izin verilmeyen seçenek gizli ya da devre dışı.
- **Yeniden adlandır:** satırı inline input'a çevirir (issue 04'teki kurallar).
- **Sil:** mevcut `DeleteMeetingDialog` onayı; açık olan Meeting silinirse Home'a dön.
- Kapat ve Metne dök mevcut servislerle aynı yolu kullanır (model yoksa `forceAsk` akışı).

## Kabul kriterleri

- [x] Her durumda menü yalnızca o durumda geçerli aksiyonları sunar (docs/meeting-lifecycle.md tablosuyla tutarlı).
- [x] Sağ tık ve "⋯" aynı menüyü açar; klavye ile erişilebilir.
- [ ] Silme onaysız çalışmaz; Recording'deki Meeting silinince kayıt düzgünce biter.

## Comments

**2026-10-22 (implementasyon + review sonrası):**

- **Doğrulama sınırı:** Durum kuralı `allowedActions` (saf, testli; docs/meeting-lifecycle.md tablosundan) detaydaki düğmelerle ve satır menüsüyle ortak. Menü tarayıcı pane'inde geçici bir `window.api` stub'ıyla denendi (pane gizli olduğu için animasyonlar kapatılarak): her durumda doğru öğeler, sağ tık ve "⋯" aynı öğeler, "⋯" Tab/Enter ile açılır ve oklarla gezilir, Esc kapatır; menüden Yeniden adlandır satırda odaklı input açar, Enter kaydeder; Sil onay ister (Vazgeç bir şey yapmaz), açık Meeting silinince Home'a dönülür; Kapat ve Metne dök çalışır. **Denenmedi:** gerçek Electron; kayıt alınırken sidebar'dan silme (detaydakiyle aynı `removeMeeting` yolu, önce Recording'i bitirir) ve kayıt sürerken Kapat'ın devre dışı kalması (`isBusyWith`, detaydakiyle aynı). Üçüncü kriter bu yüzden açık bırakıldı.
- **Animasyonlu kapanış:** Yeniden adlandırma menünün `onOpenChangeComplete`'inde başlar; aksi halde kapanan menü odağı "⋯"a geri verip yeni input'un odağını çalar. Gerçek pencerede (animasyonlar açıkken) input'un odaklı açıldığı kontrol edilmeli.
- **Model sorusu Meeting sayfasında da:** Bu dilime kadar `ModelCard` yalnızca Home'daydı; model yokken detaydan ya da sidebar'dan "Metne dök" denince soru görünmeden bekleniyordu. `forceAsk` sorusu artık Meeting sayfasında da çıkar (yalnızca bekleyen bir "Metne dök" varken). Issue 06 Home'u yeniden yazarken bunu korumalı.
- **Ortak parçalar:** Inline Title input'u `TitleInput`'a çıktı (04'teki kurallar: Enter/odaktan çıkınca kaydet, Esc vazgeç, değişmeyen ad IPC'ye gitmez); detay başlığı ve satır kullanır. Menü etiketleri `labels.ts`'te.
- **Ticket'ta yazmayan küçük kararlar:** Menü öğelerinde ikon; hover'da ya da menü açıkken satırdaki tarih "⋯"a yer açmak için gizlenir. Sağ tık menüsünün kendi klavye kısayolu (Shift+F10) yok; klavye erişimi "⋯" üzerinden.
- **Bilerek bırakılan:** Detaydaki düğme etiketleri ("Meeting'i kapat", "Transcribe") menüdekilerden ("Kapat", "Metne dök") farklı; detay ekranının yeniden tasarımı spec dışında. Sidebar satırının sağında tarih (`d MMM`) var, spec "soluk saat" diyor; 01'den kalan fark, 05'te değiştirilmedi.
