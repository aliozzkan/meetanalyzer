Status: needs-triage
Blocked by: 02

# Transcription Modeli bölümü ve footer göstergesi

Spec: [../spec.md](../spec.md) → "Ayarlar modal'ı > Transcription Modeli", "Sidebar > Alt alan"

## Yapılacaklar

- **Ayarlar > Transcription Modeli:** tek satırlık model listesi (backlog 06'da satır eklenebilsin diye liste biçiminde). Satır: ad, boyut, durum. Eylemler: indir / iptal / yeniden dene (mevcut `ModelApi`), **sil**, "Finder'da göster".
- **Sil:** Transcription Queue'da işlenen/bekleyen Meeting varken ya da indirme sürerken devre dışı (tooltip'te neden); önce onay; silince model durumu `missing`. Main'de `ModelService`'e silme ve IPC ekle; kuralı main'de de zorunlu kıl (UI'ya güvenme).
- Silme sonrası sonraki "Metne dök", mevcut `forceAsk` akışıyla indirme sorusunu yeniden açar; "Şimdilik atla" bayrağı sıfırlanmaz.
- **Footer göstergesi:** hazırsa görünmez; eksik → "Model indirilmedi"; indirme → ince ilerleme çubuğu + yüzde; hata → kırmızı "İndirme başarısız". Tıklanınca Ayarlar > Transcription Modeli açılır.

## Kabul kriterleri

- [ ] Silme, kuyruk doluyken ya da indirme sürerken hem UI'da hem main'de reddedilir.
- [ ] Silme sonrası diskte model dosyası ve kısmi indirme kalıntısı kalmaz; durum `missing` olur.
- [ ] Silinen model ile "Metne dök" indirme sorusunu açar ve onaylanırsa tekrar indirir.
- [ ] Footer göstergesi dört durumda doğru görünür; model hazırken hiç yer kaplamaz.
- [ ] `ModelService` silme testleri: hazır model, olmayan model, indirme sürerken.
