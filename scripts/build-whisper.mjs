// whisper-cli sidecar'ını (ADR-0004) ve Silero VAD modelini hazırlar:
//   resources/bin/<platform>-<arch>/whisper-cli
//   resources/models/ggml-silero-v6.2.0.bin
// Kullanım: pnpm build:whisper          derle ve modeli indir
//           pnpm check:whisper          yalnızca mevcut dosyaları doğrula (derleme yok); paketlemeden önce çalışır
// Sürümler ve gerekçeleri docs/tuning.md içindedir; değiştirirken oradaki ilgili satırı da güncelle.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  accessSync,
  chmodSync,
  constants,
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync
} from 'node:fs'
import { availableParallelism } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

// --- Sabitlenmiş sürümler -----------------------------------------------------
const WHISPER_CPP_REPO = 'https://github.com/ggml-org/whisper.cpp'
const WHISPER_CPP_TAG = 'v1.9.5'
// v1.9.5 annotated bir tag: aşağıdaki, tag'in işaret ettiği commit'tir (tag nesnesi değil).
const WHISPER_CPP_COMMIT = 'd1be6fde11ac6e0407606b4e42fe72d34add8037'

const VAD_MODEL_FILE = 'ggml-silero-v6.2.0.bin'
const VAD_MODEL_REPO = 'ggml-org/whisper-vad'
const VAD_MODEL_REVISION = '9ffd54a1e1ee413ddf265af9913beaf518d1639b'
const VAD_MODEL_SHA256 = '2aa269b785eeb53a82983a20501ddf7c1d9c48e33ab63a41391ac6c9f7fb6987'

// Taşınabilirlik: GGML_NATIVE=OFF, derleyen makinenin CPU komutlarının (ör. M4) binary'ye
// gömülmesini engeller; aksi halde daha eski bir M1'de çalışmayabilir. Ağır iş Metal'de yapılır.
// Deployment target, Electron'un desteklediği en düşük macOS ile uyumlu tutulur.
const MACOS_DEPLOYMENT_TARGET = '13.0'

// --- Yollar -------------------------------------------------------------------
// Binary'ler platforma göre ayrı klasördedir; electron-builder her platforma yalnızca kendi klasörünü
// `bin/` olarak katar (electron-builder.yml → extraResources). src/main/whisper/paths.ts aynı düzeni okur.
const TARGET = `${process.platform}-${process.arch}`
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, '.cache', 'whisper.cpp')
const BUILD_DIR = join(SRC_DIR, 'build')
const BIN_DIR = join(ROOT, 'resources', 'bin', TARGET)
const CLI_PATH = join(BIN_DIR, 'whisper-cli')
const MODELS_DIR = join(ROOT, 'resources', 'models')
const MODEL_PATH = join(MODELS_DIR, VAD_MODEL_FILE)

function log(message) {
  console.log(`\n==> ${message}`)
}

// Betiği hata mesajıyla durdurur. Fırlatılır (process.exit değil) ki `finally` blokları geçici dosyaları silsin.
class BuildError extends Error {}

function die(message) {
  throw new BuildError(message)
}

// Komutu çalıştırır; çıktısı terminale akar. Başarısızsa betik durur.
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) die(`${command} çalıştırılamadı: ${result.error.message}`)
  if (result.status !== 0)
    die(`${command} ${args[0] ?? ''} başarısız oldu (çıkış kodu ${result.status}).`)
}

// Komutu çalıştırıp stdout ve stderr'i birlikte döndürür; başarısızsa null.
function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.error || result.status !== 0) return null
  return `${result.stdout}${result.stderr}`
}

function hasTool(tool) {
  return capture('sh', ['-c', `command -v ${tool}`]) !== null
}

function sha256Of(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
  })
}

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function assertSupportedTarget() {
  if (TARGET === 'darwin-arm64') return
  if (TARGET === 'win32-x64') {
    die(
      'Windows için whisper derlemesi henüz desteklenmiyor (bkz. .scratch/windows-support/issues/02).'
    )
  }
  die(`${TARGET} desteklenmiyor; yalnızca macOS Apple Silicon (darwin-arm64).`)
}

// --- Yalnızca doğrulama (--check) ---------------------------------------------
// Binary ya da VAD modeli olmadan paket üretilirse uygulama Transcription yapamaz;
// bu yüzden build:mac, build:win ve build:unpack bu kontrolü önce çalıştırır.
async function check() {
  assertSupportedTarget()
  if (!isExecutable(CLI_PATH)) die(`${CLI_PATH} yok. Önce 'pnpm build:whisper' çalıştır.`)
  if (!existsSync(MODEL_PATH)) die(`${MODEL_PATH} yok. Önce 'pnpm build:whisper' çalıştır.`)
  if ((await sha256Of(MODEL_PATH)) !== VAD_MODEL_SHA256) {
    die(`${VAD_MODEL_FILE} SHA-256 değeri uyuşmuyor. 'pnpm build:whisper' ile yeniden indir.`)
  }
  console.log('whisper kaynakları hazır.')
}

// --- whisper.cpp kaynağı ------------------------------------------------------
function prepareSource() {
  log(`whisper.cpp ${WHISPER_CPP_TAG} kaynağı hazırlanıyor`)
  const head = existsSync(join(SRC_DIR, '.git'))
    ? capture('git', ['-C', SRC_DIR, 'rev-parse', 'HEAD'])?.trim()
    : undefined
  if (head === WHISPER_CPP_COMMIT) {
    console.log("Kaynak zaten doğru commit'te.")
    return
  }
  rmSync(SRC_DIR, { recursive: true, force: true })
  mkdirSync(dirname(SRC_DIR), { recursive: true })
  run('git', [
    'clone',
    '--quiet',
    '--depth',
    '1',
    '--branch',
    WHISPER_CPP_TAG,
    '-c',
    'advice.detachedHead=false',
    WHISPER_CPP_REPO,
    SRC_DIR
  ])
  const actual = capture('git', ['-C', SRC_DIR, 'rev-parse', 'HEAD'])?.trim()
  if (actual !== WHISPER_CPP_COMMIT) {
    die(
      `${WHISPER_CPP_TAG} beklenen commit'i göstermiyor (beklenen ${WHISPER_CPP_COMMIT}, gelen ${actual}).`
    )
  }
}

// --- Derleme (macOS) ----------------------------------------------------------
function buildMac() {
  log('whisper-cli derleniyor (Metal, statik)')
  run('cmake', [
    '-S',
    SRC_DIR,
    '-B',
    BUILD_DIR,
    '-DCMAKE_BUILD_TYPE=Release',
    '-DCMAKE_OSX_ARCHITECTURES=arm64',
    `-DCMAKE_OSX_DEPLOYMENT_TARGET=${MACOS_DEPLOYMENT_TARGET}`,
    '-DBUILD_SHARED_LIBS=OFF',
    '-DGGML_METAL=ON',
    '-DGGML_METAL_EMBED_LIBRARY=ON',
    '-DGGML_NATIVE=OFF',
    '-DWHISPER_BUILD_TESTS=OFF',
    '-DWHISPER_BUILD_SERVER=OFF'
  ])
  run('cmake', [
    '--build',
    BUILD_DIR,
    '--config',
    'Release',
    '--target',
    'whisper-cli',
    '-j',
    String(availableParallelism())
  ])

  mkdirSync(BIN_DIR, { recursive: true })
  copyFileSync(join(BUILD_DIR, 'bin', 'whisper-cli'), CLI_PATH)
  chmodSync(CLI_PATH, 0o755)
}

// --- Binary doğrulaması (macOS) -----------------------------------------------
function verifyMac() {
  log('whisper-cli doğrulanıyor')
  // Sistem kütüphaneleri dışında bir bağımlılık (libwhisper/libggml dylib'leri gibi) kalmamalı;
  // aksi halde paketlenmiş uygulamada binary çalışmaz.
  const otoolOutput = capture('otool', ['-L', CLI_PATH])
  if (otoolOutput === null) die('otool -L çalışmadı.')
  const externalDeps = otoolOutput
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((dep) => dep && !/^(\/usr\/lib\/|\/System\/Library\/)/.test(dep))
  if (externalDeps.length > 0) die(`Sistem dışı bağımlılıklar var:\n${externalDeps.join('\n')}`)
  verifyHelp()
  console.log(`Tamam: ${CLI_PATH}`)
}

function verifyHelp() {
  const helpOutput = capture(CLI_PATH, ['--help'])
  if (helpOutput === null) die('whisper-cli --help çalışmadı.')
  if (!helpOutput.includes('--vad')) die('whisper-cli --vad bayrağını tanımıyor.')
}

// --- VAD modeli ---------------------------------------------------------------
async function prepareVadModel() {
  log(`VAD modeli (${VAD_MODEL_FILE}) hazırlanıyor`)
  mkdirSync(MODELS_DIR, { recursive: true })
  for (const name of readdirSync(MODELS_DIR)) {
    if (name.startsWith('.download.')) rmSync(join(MODELS_DIR, name), { force: true }) // önceki yarım kalmış indirmeler
  }
  if (existsSync(MODEL_PATH) && (await sha256Of(MODEL_PATH)) === VAD_MODEL_SHA256) {
    console.log('Model zaten mevcut ve SHA-256 doğru.')
    return
  }

  const tmp = join(MODELS_DIR, `.download.${process.pid}`)
  try {
    const url = `https://huggingface.co/${VAD_MODEL_REPO}/resolve/${VAD_MODEL_REVISION}/${VAD_MODEL_FILE}`
    const response = await fetch(url)
    if (!response.ok || !response.body) die(`VAD modeli indirilemedi (HTTP ${response.status}).`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(tmp))
    const actual = await sha256Of(tmp)
    if (actual !== VAD_MODEL_SHA256) {
      die(`VAD modelinin SHA-256 değeri uyuşmuyor (beklenen ${VAD_MODEL_SHA256}, gelen ${actual}).`)
    }
    chmodSync(tmp, 0o644)
    renameSync(tmp, MODEL_PATH)
  } finally {
    rmSync(tmp, { force: true })
  }
  console.log(`Tamam: ${MODEL_PATH}`)
}

// --- Ana akış -----------------------------------------------------------------
async function build() {
  assertSupportedTarget()
  for (const tool of ['git', 'cmake', 'otool']) {
    if (!hasTool(tool)) die(`'${tool}' bulunamadı.`)
  }
  prepareSource()
  buildMac()
  verifyMac()
  await prepareVadModel()
  log('Bitti')
}

try {
  await (process.argv[2] === '--check' ? check() : build())
} catch (error) {
  if (!(error instanceof BuildError)) throw error
  console.error(`HATA: ${error.message}`)
  process.exitCode = 1
}
