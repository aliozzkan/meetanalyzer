Status: needs-triage

# Windows code signing

Windows installer imzasız dağıtılıyor; SmartScreen ilk çalıştırmada "Windows kişisel bilgisayarınızı korudu" uyarısı veriyor. İmzalamak için bir sertifika (OV, EV ya da Azure Trusted Signing), electron-builder'da `win.signtoolOptions` / imzalama ayarı ve `whisper-cli.exe` ile dll'lerin de imzalanması gerekir. macOS'ta da `notarize: false`; iki platformun imzalaması birlikte ele alınabilir.

Bağlam: [../../windows-support/spec.md](../../windows-support/spec.md)
