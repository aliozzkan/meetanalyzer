Status: ready-for-human
Blocked by: 01, 02, 03, 04, 05

# NSIS paketi ve temiz Windows'ta uçtan uca duman testi

Spec: [../spec.md](../spec.md) → "Kurulum", "Kabul kriterleri"

Temiz bir Windows kurulumu, GPU'lu ve GPU'suz makine ve gerçek kullanım gerektirdiği için insan işi.

## Yapılacaklar

- `electron-builder.yml` → `nsis`: `oneClick: true`, `perMachine: false`; mevcut kısayol ve ad ayarları kalır. `pnpm build:win` ile installer üretilir.
- Temiz bir Windows 11 x64'te (tercihen kullanıcı adında Türkçe karakter olan bir hesapla) ve GPU'suz bir sanal makinede test edilir.

## Kontrol listesi

- Kurulum admin istemez, `%LOCALAPPDATA%\Programs\` altına kurar, kısayollar oluşur. SmartScreen uyarısı beklenir.
- VC++ Redistributable istenmez.
- Model indirilir; mikrofonla bir Recording alınır; Transcription tamamlanır (GPU'lu makinede Vulkan, sanal makinede CPU); Correction'da Suspect Word dinletilir; Approve edilir.
- Onaydan sonra ses klasörü silinmiştir.
- Recording sürerken `powercfg /requests` → SYSTEM altında uygulama; Recording durunca kaybolur.
- Mikrofon gizlilik anahtarı kapalıyken Recording başlamaz, "Ayarları aç" doğru sayfayı açar.
- Recording sürerken X → onay sorulur.
- Kaldırma uygulamayı siler. Kullanıcı verisi (`%APPDATA%`) varsayılan electron-builder davranışıyla kalır; bu not edilir.

## Kabul kriterleri

- [ ] Installer üretilir ve kontrol listesindeki her madde iki makinede de geçer.
- [ ] Sonuçlar ve beklenmeyen davranışlar bu issue'nun altına yazılır; tasarımı değiştirenler spec'e ve ilgili issue'lara not düşülür.
