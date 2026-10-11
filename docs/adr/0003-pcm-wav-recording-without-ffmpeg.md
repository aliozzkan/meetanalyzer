---
status: accepted
---

# Recording doğrudan 16 kHz mono PCM WAV olarak alınır; ffmpeg kullanılmaz

Renderer'da `AudioContext({ sampleRate: 16000 })` + `AudioWorklet` ile üretilen PCM, parçalar halinde IPC ile main process'e gönderilir ve `.wav` dosyasına append edilir; WAV header'ı Recording bitince yazılır, çökme sonrası açılışta onarılır. Bu, whisper.cpp'nin istediği formatın ta kendisidir, dönüştürme adımı yoktur.

## Considered Options

- **`MediaRecorder` (webm/opus) + `ffmpeg-static` ile WAV'a dönüştürme**: dosyalar küçük olurdu, ama `ffmpeg-static`'in dağıttığı binary GPL build'idir ve kapalı kaynak ticari bir uygulamaya gömülmesi lisans riski taşır; ayrıca pakete ~70 MB ekler.

## Consequences

- Ses dosyaları büyüktür (saatte ~115 MB). Approved'dan sonra silindikleri için kalıcı bir yük değildir.
