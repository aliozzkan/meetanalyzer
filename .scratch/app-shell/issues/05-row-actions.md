Status: needs-triage
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

- [ ] Her durumda menü yalnızca o durumda geçerli aksiyonları sunar (docs/meeting-lifecycle.md tablosuyla tutarlı).
- [ ] Sağ tık ve "⋯" aynı menüyü açar; klavye ile erişilebilir.
- [ ] Silme onaysız çalışmaz; Recording'deki Meeting silinince kayıt düzgünce biter.
