#!/usr/bin/env bash
# whisper-cli sidecar'ını (ADR-0004) ve Silero VAD modelini hazırlar:
#   resources/bin/whisper-cli
#   resources/models/ggml-silero-v6.2.0.bin
# Kullanım: pnpm build:whisper          derle ve modeli indir
#           pnpm check:whisper          yalnızca mevcut dosyaları doğrula (derleme yok); paketlemeden önce çalışır
# Sürümler ve gerekçeleri docs/tuning.md içindedir; değiştirirken oradaki ilgili satırı da güncelle.
set -euo pipefail

# --- Sabitlenmiş sürümler -----------------------------------------------------
WHISPER_CPP_REPO="https://github.com/ggml-org/whisper.cpp"
WHISPER_CPP_TAG="v1.9.5"
# v1.9.5 annotated bir tag: aşağıdaki, tag'in işaret ettiği commit'tir (tag nesnesi değil).
WHISPER_CPP_COMMIT="d1be6fde11ac6e0407606b4e42fe72d34add8037"

VAD_MODEL_FILE="ggml-silero-v6.2.0.bin"
VAD_MODEL_REPO="ggml-org/whisper-vad"
VAD_MODEL_REVISION="9ffd54a1e1ee413ddf265af9913beaf518d1639b"
VAD_MODEL_SHA256="2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987"

# Taşınabilirlik: GGML_NATIVE=OFF, derleyen makinenin CPU komutlarının (ör. M4) binary'ye
# gömülmesini engeller; aksi halde daha eski bir M1'de çalışmayabilir. Ağır iş Metal'de yapılır.
# Deployment target, Electron'un desteklediği en düşük macOS ile uyumlu tutulur.
MACOS_DEPLOYMENT_TARGET="13.0"

# --- Yollar -------------------------------------------------------------------
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT/.cache/whisper.cpp"
BUILD_DIR="$SRC_DIR/build"
BIN_DIR="$ROOT/resources/bin"
MODELS_DIR="$ROOT/resources/models"

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'HATA: %s\n' "$*" >&2; exit 1; }

sha_of() { shasum -a 256 "$1" | awk '{print $1}'; }

# --- Yalnızca doğrulama (--check) ---------------------------------------------
# Binary ya da VAD modeli olmadan paket üretilirse uygulama Transcription yapamaz;
# bu yüzden build:mac ve build:unpack bu kontrolü önce çalıştırır.
if [[ "${1:-}" == "--check" ]]; then
  [[ -x "$BIN_DIR/whisper-cli" ]] || die "$BIN_DIR/whisper-cli yok. Önce 'pnpm build:whisper' çalıştır."
  model_path="$MODELS_DIR/$VAD_MODEL_FILE"
  [[ -f "$model_path" ]] || die "$model_path yok. Önce 'pnpm build:whisper' çalıştır."
  [[ "$(sha_of "$model_path")" == "$VAD_MODEL_SHA256" ]] ||
    die "$VAD_MODEL_FILE SHA-256 değeri uyuşmuyor. 'pnpm build:whisper' ile yeniden indir."
  echo "whisper kaynakları hazır."
  exit 0
fi

# --- Ön kontroller ------------------------------------------------------------
[[ "$(uname -s)" == "Darwin" && "$(uname -m)" == "arm64" ]] ||
  die "Şimdilik yalnızca macOS Apple Silicon destekleniyor (bkz. .scratch/backlog: Windows desteği)."
for tool in git cmake curl shasum otool; do
  command -v "$tool" >/dev/null || die "'$tool' bulunamadı."
done

# --- whisper.cpp kaynağı ------------------------------------------------------
log "whisper.cpp $WHISPER_CPP_TAG kaynağı hazırlanıyor"
if [[ -d "$SRC_DIR/.git" && "$(git -C "$SRC_DIR" rev-parse HEAD 2>/dev/null)" == "$WHISPER_CPP_COMMIT" ]]; then
  echo "Kaynak zaten doğru commit'te."
else
  rm -rf "$SRC_DIR"
  mkdir -p "$(dirname "$SRC_DIR")"
  git clone --quiet --depth 1 --branch "$WHISPER_CPP_TAG" -c advice.detachedHead=false \
    "$WHISPER_CPP_REPO" "$SRC_DIR"
  actual="$(git -C "$SRC_DIR" rev-parse HEAD)"
  [[ "$actual" == "$WHISPER_CPP_COMMIT" ]] ||
    die "$WHISPER_CPP_TAG beklenen commit'i göstermiyor (beklenen $WHISPER_CPP_COMMIT, gelen $actual)."
fi

# --- Derleme ------------------------------------------------------------------
log "whisper-cli derleniyor (Metal, statik)"
cmake -S "$SRC_DIR" -B "$BUILD_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET="$MACOS_DEPLOYMENT_TARGET" \
  -DBUILD_SHARED_LIBS=OFF \
  -DGGML_METAL=ON \
  -DGGML_METAL_EMBED_LIBRARY=ON \
  -DGGML_NATIVE=OFF \
  -DWHISPER_BUILD_TESTS=OFF \
  -DWHISPER_BUILD_SERVER=OFF
cmake --build "$BUILD_DIR" --config Release --target whisper-cli -j "$(sysctl -n hw.ncpu)"

mkdir -p "$BIN_DIR"
install -m 755 "$BUILD_DIR/bin/whisper-cli" "$BIN_DIR/whisper-cli"

# --- Binary doğrulaması -------------------------------------------------------
log "whisper-cli doğrulanıyor"
# Sistem kütüphaneleri dışında bir bağımlılık (libwhisper/libggml dylib'leri gibi) kalmamalı;
# aksi halde paketlenmiş uygulamada binary çalışmaz.
# Komut çıktıları önce değişkene alınır: boru hattında `|| true` otool hatasını da yutardı.
otool_output="$(otool -L "$BIN_DIR/whisper-cli")" || die "otool -L çalışmadı."
external_deps="$(printf '%s\n' "$otool_output" | tail -n +2 | awk '{print $1}' |
  { grep -vE '^(/usr/lib/|/System/Library/)' || true; })"
[[ -z "$external_deps" ]] || die "Sistem dışı bağımlılıklar var:
$external_deps"
help_output="$("$BIN_DIR/whisper-cli" --help 2>&1)" || die "whisper-cli --help çalışmadı."
[[ "$help_output" == *"--vad"* ]] || die "whisper-cli --vad bayrağını tanımıyor."
echo "Tamam: $BIN_DIR/whisper-cli"

# --- VAD modeli ---------------------------------------------------------------
log "VAD modeli ($VAD_MODEL_FILE) hazırlanıyor"
mkdir -p "$MODELS_DIR"
rm -f "$MODELS_DIR"/.download.* # önceki yarım kalmış indirmeler
model_path="$MODELS_DIR/$VAD_MODEL_FILE"
if [[ -f "$model_path" && "$(sha_of "$model_path")" == "$VAD_MODEL_SHA256" ]]; then
  echo "Model zaten mevcut ve SHA-256 doğru."
else
  tmp="$(mktemp "$MODELS_DIR/.download.XXXXXX")"
  trap 'rm -f "$tmp"' EXIT
  curl --fail --location --silent --show-error \
    "https://huggingface.co/$VAD_MODEL_REPO/resolve/$VAD_MODEL_REVISION/$VAD_MODEL_FILE" -o "$tmp"
  actual="$(sha_of "$tmp")"
  [[ "$actual" == "$VAD_MODEL_SHA256" ]] ||
    die "VAD modelinin SHA-256 değeri uyuşmuyor (beklenen $VAD_MODEL_SHA256, gelen $actual)."
  chmod 644 "$tmp"
  mv "$tmp" "$model_path"
  trap - EXIT
  echo "Tamam: $model_path"
fi

log "Bitti"
