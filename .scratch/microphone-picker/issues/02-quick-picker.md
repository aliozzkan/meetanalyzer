Status: resolved
Blocked by: 01

# Kayıt öncesi hızlı mikrofon seçici

Spec: [../spec.md](../spec.md) → "Seçim"

Toplantıdan hemen önce cihaz değiştirmek için Ayarlar'ı açmak gerekmesin. "Kaydı başlat" düğmesinin yanında, Ayarlardaki seçimle aynı kaynaktan okuyup yazan küçük bir seçici.

## Yapılacaklar

- `recording-controls.tsx`: Recording durumu `idle` iken "Kaydı başlat" düğmesinin yanına mikrofon seçici (açılır menü; etiket olarak seçili cihazın adı ya da "Sistem varsayılanı"). Menü içeriği issue 01'deki cihaz listesi hook'undan gelir.
- Recording `starting`, `recording` ve `stopping` iken seçici gösterilmez ya da devre dışıdır.
- Seçim Ayarlardaki seçimle aynı durumdur: biri değişince diğeri güncellenir (ortak hook/durum, çift kaynak yok).
- İzin yok uyarısı ve "Yeni Recording başlat" düğmelerinin bulunduğu durumlarda da seçici erişilebilir olmalıdır ki kullanıcı kopma sonrası cihaz değiştirip yeniden başlatabilsin.

## Kabul kriterleri

- [ ] Seçici yalnızca kayıt başlamadan önce görünür/etkin; kayıt sırasında değiştirilemez.
- [ ] Seçicide yapılan değişiklik Ayarlar modal'ında anında görünür ve tersi de geçerlidir.
- [ ] Bağlı olmayan kaydedilmiş cihaz seçicide "X (bağlı değil)" olarak görünür.
- [ ] Kopma sonrası uyarıdaki "Yeni Recording başlat"tan önce seçici kullanılabilir.
- [ ] Seçici klavye ile kullanılabilir ve etiketlidir (`aria-label`).

## Uygulama notu

Kod tamamlandı; `pnpm typecheck` ve `eslint src` temiz. Arayüz bileşenleri projede elle doğrulanır (vitest yalnızca saf TS); doğrulama [issue 04](04-device-verification.md)'te.

- `RecordingControls`, Recording `idle` iken "Kaydı başlat"ın yanında `MicrophoneSelect` (küçük boyut) gösterir; `starting`/`stopping` ve başka Meeting'de kayıt sürerken devre dışıdır, kayıt sürerken hiç gösterilmez. Seçici Ayarlar'daki ile aynı `useMicrophone` durumunu paylaşır (`AppContext.microphone` → `MeetingPage` → `MeetingDetail` → `RecordingControls`).
- Kopma uyarısındaki "Yeni Recording başlat" düğmesi aynı `idle` bloğunda değildir; seçici o anda zaten görünür (uyarı Recording bittikten sonra çıkar).
