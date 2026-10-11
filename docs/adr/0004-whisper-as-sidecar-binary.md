---
status: accepted
---

# whisper.cpp, Node binding yerine sidecar binary olarak çalıştırılır

Transcription, uygulamaya gömülü `whisper-cli` binary'sinin `child_process.spawn` ile çalıştırılmasıyla yapılır; çıktı `-ojf` ile JSON olarak (zaman damgaları ve token olasılıklarıyla) okunur. Binary, `scripts/build-whisper.sh` ile sabit bir whisper.cpp release tag'inden Metal desteğiyle derlenir ve git'e commit edilmez.

## Considered Options

- **Node binding'leri (`nodejs-whisper`, `whisper-node`, `@fugood/whisper.node`)**: her Electron ABI güncellemesinde native rebuild gerektirir, bakımları dalgalıdır ve bir crash main process'i düşürür.

## Consequences

- Crash izole kalır, iptal `kill` kadar basittir, process düşük öncelikle (nice) çalıştırılabilir.
- Her platform için ayrı binary derlenip dağıtılmalıdır.
