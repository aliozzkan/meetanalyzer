Status: ready-for-agent
Blocked by: 01, 02

# Yeni Meeting split button'u ve kayıt pill'i

Spec: [../spec.md](../spec.md) → "Sidebar > Üst alan", "Kısayollar"

## Yapılacaklar

- Sidebar üstünde üç durum:
  - Açık Meeting yok → split button: ana kısım Default Language ile hemen başlatır, ▾ dil seçip başlatır.
  - Recording durumunda Meeting var, kayıt yok → nötr "Açık Meeting'e dön" pill'i (split button gizli).
  - Kayıt sürüyor → kırmızı "● Kayıt sürüyor · mm:ss" pill'i + durdur butonu; pill tıklanınca Meeting açılır. Durdur, global recorder'ı (issue 01) kullanır.
- Başlatılan Meeting otomatik açılır.
- ⌘N: Default Language ile Yeni Meeting; açık Meeting varsa ona git. macOS menüsünde File > Yeni Meeting.
- Issue 01'deki geçici Home'daki başlatma kontrolü kalabilir (kalıcı Home issue 06'da).
- Sidebar ikon modunda pill ve buton ikona indirgenir (kırmızı nokta + tooltip).

## Kabul kriterleri

- [ ] Üç durum arasındaki geçişler doğru çalışır (başlat → kayıt → durdur → Meeting'i kapat).
- [ ] Başka bir ekrandayken pill'deki durdur kaydı düzgünce bitirir (WAV geçerli, `recording_channels` süresi yazılı).
- [ ] ⌘N açık Meeting varken yeni Meeting oluşturmaz.
- [ ] Süre göstergesi detaydaki `RecordingControls` ile aynı değeri gösterir.
