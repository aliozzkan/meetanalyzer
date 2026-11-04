Status: ready-for-human
Blocked by: 01, 03

# Mikrofon seçicinin gerçek cihazlarla doğrulanması

Spec: [../spec.md](../spec.md) → "Doğrulanmamış varsayımlar"

Gerçek cihaz, fiziksel takıp çıkarma ve dinleme gerektirdiği için insan işi. Sonuçlar spec'in "Doğrulanmamış varsayımlar" bölümüne yazılır; varsayım tutmuyorsa ilgili issue yeniden açılır.

## Ölçülecekler

- macOS ve Windows'ta `deviceId: { exact }` ile bağlı olmayan cihaz isteği `OverconstrainedError` veriyor mu; izin reddi hâlâ `NotAllowedError`.
- `deviceId` uygulama yeniden başlatılınca aynı kalıyor mu; kalmıyorsa etiketle eşleştirme yedeği eklenir (yeni issue).
- Kayıt sürerken seçili USB mikrofonu çıkar: track `ended` oluyor mu, Recording sürüyor mu, varsayılana geçiliyor mu. Aynısı kablolu kulaklık mikrofonu ve AirPods için.
- AirPods'u kayıt sırasında tak: "Sistem varsayılanı" seçiliyken açık akış varsayılan giriş değişikliğini izliyor mu, yoksa eski cihazda mı kalıyor. Kalıyorsa kullanıcıya nasıl anlatılacağı belirlenir.
- Geçişten sonra `mic.wav` ve `system.wav` süreleri: fark kopma süresinden büyük mü; kopma anına denk gelen konuşma ve Transcript'te Side sıralaması bozuluyor mu.
- Sessiz mikrofon uyarısı geçişten sonra yeni cihaz sessizse 10 sn sonra çıkıyor mu.
- Mikrofon izni hiç verilmemişken Ayarlar › Mikrofon listesi etiket göstermiyor, izin verilince doluyor mu.

## Kabul kriterleri

- [ ] Her ölçümün sonucu spec'e yazılmıştır.
- [ ] Spec'teki varsayımlardan tutmayan her biri için bir issue açılmıştır.
