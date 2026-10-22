Status: resolved
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

- [x] Title boşluklarla kırpılır, 121 karakter reddedilir, boş kaydetmek Title'ı siler.
- [x] Approved Meeting'in Title'ı değiştirilebilir; Approved Transcript değişmez.
- [x] Sidebar satırı Title varken onu, yokken saati gösterir; ad değişince anında güncellenir.
- [x] Servis testleri: kırpma, uzunluk, olmayan Meeting, Approved durumunda yeniden adlandırma.

## Comments

**2026-10-22 (implementasyon + review sonrası):**

- **Doğrulama sınırı:** Kurallar `MeetingService.rename` testlerinde (kırpma, boş → `NULL`, 120/121 sınırı, olmayan Meeting, Approved'da yeniden adlandırma ve Approved Transcript'in değişmemesi). Arayüz tarayıcı pane'inde geçici bir `window.api` stub'ıyla denendi: Enter tek kaydetme yapar, Esc IPC'ye gitmeden vazgeçer, odaktan çıkmak kaydeder, değişmeyen ad IPC'ye gitmez, boşaltınca sidebar saate döner, Approved Meeting yeniden adlandırılır; sidebar her seferinde anında güncellenir. Gerçek Electron'da (migration'ın mevcut veritabanına uygulanması dahil) **denenmedi**.
- **Kurallar tek yerde:** Kırpma ve boş → null `normalizeTitle`'da (`src/shared/meeting.ts`); main bunu kullanıp uzunluğu denetler, renderer yalnızca "ad değişti mi" kararında kullanır. Input `maxLength` ile 120'de sınırlı; bu kırpılmamış metni sayar, yani başında/sonunda boşluk olan 120+ karakterlik bir yapıştırma tarayıcıda kesilir (main'in 121 reddine arayüzden ulaşılamaz). Bilerek bırakıldı.
- **Geçersiz IPC girdisi:** String olmayan `title` `internal-error` döner; `src/main/ipc-result.ts`'teki kurala uygun, `typeof` kontrolü eklenmedi.
- **Ticket'ta yazmayan küçük kararlar:** Odaktan çıkmak da kaydeder (Finder'daki yeniden adlandırma gibi); Title varken tarih başlıktan düştüğü için alt satıra (`tarih · dil · kayıt`) taşındı; başlıkta hover'da kalem ikonu.
- **Analysis Request notu:** Henüz Analysis Request issue'su yok; kural `docs/meeting-lifecycle.md` → "Backend ile ilişki"ye yazıldı. O issue yazılırken oraya taşınmalı.
- **05 için:** Sidebar'daki "Yeniden adlandır" `MeetingsApi.rename`'i kullanabilir; satır adı `meetingLabel`'dadır.
