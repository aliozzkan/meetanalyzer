Status: ready-for-agent
Blocked by: 01

# Meeting Title

Spec: [../spec.md](../spec.md) → "Title". GLOSSARY'de **Title** tanımlı.

## Yapılacaklar

- Yeni migration: `meetings.title TEXT` (nullable). Mevcut migration'ları değiştirme.
- Servis + IPC: `renameMeeting(id, title)`; main'de `trim()`, boş string → `NULL`, en fazla 120 karakter (aşarsa hata). **Her durumda** (Approved dahil) çalışır; var olmayan Meeting'de hata döner.
- `MeetingSummary`'ye `title` ekle; sidebar satırı Title'ı, yoksa saati gösterir.
- Detay başlığında inline düzenleme (tıkla/Enter kaydet, Esc vazgeç); boşken yer tutucu tarih.
- Title Analysis Request payload'ına girmez (backend gönderimi yazıldığında geçerli kural; ilgili issue'ya not düş).

## Kabul kriterleri

- [ ] Title boşluklarla kırpılır, 121 karakter reddedilir, boş kaydetmek Title'ı siler.
- [ ] Approved Meeting'in Title'ı değiştirilebilir; Approved Transcript değişmez.
- [ ] Sidebar satırı Title varken onu, yokken saati gösterir; ad değişince anında güncellenir.
- [ ] Servis testleri: kırpma, uzunluk, olmayan Meeting, Approved durumunda yeniden adlandırma.
