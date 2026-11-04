// whisper-cli sidecar'ını (ADR-0004, Windows için ADR-0009) ve Silero VAD modelini hazırlar:
//   resources/bin/<platform>-<arch>/whisper-cli           (macOS: tek statik dosya)
//   resources/bin/<platform>-<arch>/whisper-cli.exe, *.dll (Windows)
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
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
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

// Windows duman testi için küçük bir model (yalnızca .cache'e iner, pakete girmez). Transcription modeliyle
// aynı repo ve revision (src/main/config.ts).
const SMOKE_MODEL_FILE = 'ggml-tiny-q5_1.bin'
const SMOKE_MODEL_REPO = 'ggerganov/whisper.cpp'
const SMOKE_MODEL_REVISION = '5359861c739e955e79d9a303bcbc70fb988958b1'
const SMOKE_MODEL_SHA256 = '818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7'

// Taşınabilirlik: GGML_NATIVE=OFF, derleyen makinenin CPU komutlarının (ör. M4) binary'ye
// gömülmesini engeller; aksi halde daha eski bir M1'de çalışmayabilir. Ağır iş Metal'de yapılır.
// Deployment target, Electron'un desteklediği en düşük macOS ile uyumlu tutulur.
const MACOS_DEPLOYMENT_TARGET = '13.0'

// --- Yollar -------------------------------------------------------------------
// Binary'ler platforma göre ayrı klasördedir; electron-builder her platforma yalnızca kendi klasörünü
// `bin/` olarak katar (electron-builder.yml → extraResources). src/main/whisper/paths.ts aynı düzeni okur.
const TARGET = `${process.platform}-${process.arch}`
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_DIR = join(ROOT, '.cache')
const SRC_DIR = join(CACHE_DIR, 'whisper.cpp')
const BUILD_DIR = join(SRC_DIR, `build-${TARGET}`)
const BIN_DIR = join(ROOT, 'resources', 'bin', TARGET)
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
function capture(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.error || result.status !== 0) return null
  return `${result.stdout}${result.stderr}`
}

function hasTool(tool, env) {
  return process.platform === 'win32'
    ? capture('where', [tool], { env }) !== null
    : capture('sh', ['-c', `command -v ${tool}`]) !== null
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

// Dosyayı indirir ve SHA-256'sını doğrular; yarım ya da bozuk indirme hedefe hiç yazılmaz.
async function downloadVerified({ label, url, path, sha256 }) {
  const dir = dirname(path)
  mkdirSync(dir, { recursive: true })
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.download.')) rmSync(join(dir, name), { force: true }) // önceki yarım kalmış indirmeler
  }
  if (existsSync(path) && (await sha256Of(path)) === sha256) {
    console.log(`${label} zaten mevcut ve SHA-256 doğru.`)
    return
  }

  const tmp = join(dir, `.download.${process.pid}`)
  try {
    const response = await fetch(url).catch((error) =>
      die(`${label} indirilemedi: ${error.cause?.code ?? error.message}. Tekrar dene.`)
    )
    if (!response.ok || !response.body) die(`${label} indirilemedi (HTTP ${response.status}).`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(tmp))
    const actual = await sha256Of(tmp)
    if (actual !== sha256) {
      die(`${label} SHA-256 değeri uyuşmuyor (beklenen ${sha256}, gelen ${actual}).`)
    }
    chmodSync(tmp, 0o644)
    renameSync(tmp, path)
  } finally {
    rmSync(tmp, { force: true })
  }
  console.log(`Tamam: ${path}`)
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

function verifyHelp(cliPath) {
  const helpOutput = capture(cliPath, ['--help'])
  if (helpOutput === null) die('whisper-cli --help çalışmadı.')
  if (!helpOutput.includes('--vad')) die('whisper-cli --vad bayrağını tanımıyor.')
}

// --- macOS --------------------------------------------------------------------
const MAC_CLI_PATH = join(BIN_DIR, 'whisper-cli')

function buildMac() {
  for (const tool of ['git', 'cmake', 'otool']) {
    if (!hasTool(tool)) die(`'${tool}' bulunamadı.`)
  }
  prepareSource()

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
  copyFileSync(join(BUILD_DIR, 'bin', 'whisper-cli'), MAC_CLI_PATH)
  chmodSync(MAC_CLI_PATH, 0o755)

  log('whisper-cli doğrulanıyor')
  // Sistem kütüphaneleri dışında bir bağımlılık (libwhisper/libggml dylib'leri gibi) kalmamalı;
  // aksi halde paketlenmiş uygulamada binary çalışmaz.
  const otoolOutput = capture('otool', ['-L', MAC_CLI_PATH])
  if (otoolOutput === null) die('otool -L çalışmadı.')
  const externalDeps = otoolOutput
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((dep) => dep && !/^(\/usr\/lib\/|\/System\/Library\/)/.test(dep))
  if (externalDeps.length > 0) die(`Sistem dışı bağımlılıklar var:\n${externalDeps.join('\n')}`)
  verifyHelp(MAC_CLI_PATH)
  console.log(`Tamam: ${MAC_CLI_PATH}`)
}

// --- Windows (ADR-0009) -------------------------------------------------------
const WIN_CLI_PATH = join(BIN_DIR, 'whisper-cli.exe')
const SYSTEM32 = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')

// Pakete girmeyen ama izin verilen bağımlılıklar. vulkan-1.dll GPU sürücüsüyle gelir; yoksa ggml Vulkan
// backend'ini yüklemez ve CPU'yla devam eder. api-ms-win-* / ext-ms-* Windows'un API set adlarıdır.
const ALLOWED_EXTERNAL_DLL = /^(vulkan-1\.dll|api-ms-win-.*|ext-ms-.*)$/i
// VC++ runtime ve OpenMP dll'leri kullanıcıdan VC++ Redistributable isterdi; CRT statik bağlanır, OpenMP kapalıdır.
const FORBIDDEN_DLL = /^(msvcp|vcruntime|vcomp|concrt|libomp|ucrtbased)/i

// whisper'ın argv'si ve fopen'ı sistemin ANSI kod sayfasıyla çalışır; ASCII dışı karakterli yollar (kullanıcı
// adındaki `ç` gibi) ancak UTF-8 kod sayfasıyla açılır (Windows 10 1903+). trustInfo, MSVC'nin varsayılan
// manifest'indeki asInvoker'ı korur.
const UTF8_MANIFEST = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <activeCodePage xmlns="http://schemas.microsoft.com/SMI/2019/WindowsSettings">UTF-8</activeCodePage>
    </windowsSettings>
  </application>
</assembly>
`

function findVisualStudio() {
  const vswhere = join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  )
  const path = existsSync(vswhere)
    ? capture(vswhere, [
        '-latest',
        '-products',
        '*',
        '-requires',
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        '-property',
        'installationPath'
      ])?.trim()
    : undefined
  if (!path) {
    die(
      "C++ derleyicisi bulunamadı. Visual Studio ya da Build Tools'a 'Desktop development with C++' iş yükünü ekle."
    )
  }
  return path
}

// Visual Studio geliştirici ortamını (cl, link, dumpbin, mt, cmake, ninja PATH'te) ortam değişkenleri olarak
// döndürür. chcp 65001: `set` çıktısı UTF-8 gelsin, ASCII dışı karakterli yollar bozulmasın.
function visualStudioEnv(vsPath) {
  const vsDevCmd = join(vsPath, 'Common7', 'Tools', 'VsDevCmd.bat')
  const output = capture(
    'cmd.exe',
    [
      '/d',
      '/s',
      '/c',
      `"chcp 65001 >nul && call "${vsDevCmd}" -arch=x64 -host_arch=x64 -no_logo && set"`
    ],
    { windowsVerbatimArguments: true }
  )
  if (output === null) die(`${vsDevCmd} çalıştırılamadı.`)
  const env = {}
  for (const line of output.split(/\r?\n/)) {
    const eq = line.indexOf('=')
    if (eq > 0) env[line.slice(0, eq)] = line.slice(eq + 1)
  }
  return env
}

// Kurulumdan sonra açılmamış bir terminalde VULKAN_SDK henüz tanımlı olmayabilir; varsayılan kurulum
// klasöründeki en yeni sürüm kullanılır.
function findVulkanSdk(env) {
  if (env.VULKAN_SDK && existsSync(env.VULKAN_SDK)) return env.VULKAN_SDK
  const root = 'C:\\VulkanSDK'
  const versions = existsSync(root)
    ? readdirSync(root).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : []
  if (versions.length === 0) die('Vulkan SDK bulunamadı (https://vulkan.lunarg.com/sdk/home).')
  return join(root, versions.at(-1))
}

function windowsBuildEnv() {
  if (!hasTool('git')) die("'git' bulunamadı.")
  const env = visualStudioEnv(findVisualStudio())
  const vulkanSdk = findVulkanSdk(env)
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === 'PATH') ?? 'Path'
  env.VULKAN_SDK = vulkanSdk
  env[pathKey] = `${join(vulkanSdk, 'Bin')};${env[pathKey]}`
  for (const tool of ['cl', 'cmake', 'ninja', 'dumpbin', 'mt', 'glslc']) {
    if (!hasTool(tool, env)) die(`'${tool}' Visual Studio ya da Vulkan SDK ortamında bulunamadı.`)
  }
  return env
}

function buildWindows() {
  const env = windowsBuildEnv()
  prepareSource()

  log('whisper-cli derleniyor (Vulkan + CPU varyantları, dinamik backend, statik CRT)')
  run(
    'cmake',
    [
      '-S',
      SRC_DIR,
      '-B',
      BUILD_DIR,
      '-G',
      'Ninja',
      '-DCMAKE_BUILD_TYPE=Release',
      '-DCMAKE_C_COMPILER=cl',
      '-DCMAKE_CXX_COMPILER=cl',
      '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded',
      // whisper.cpp'nin cmake_minimum_required'ı CMP0091'den eski olabilir; politika açıkça açılmazsa
      // CMAKE_MSVC_RUNTIME_LIBRARY etkisiz kalır.
      '-DCMAKE_POLICY_DEFAULT_CMP0091=NEW',
      '-DBUILD_SHARED_LIBS=ON',
      '-DGGML_BACKEND_DL=ON',
      '-DGGML_CPU_ALL_VARIANTS=ON',
      '-DGGML_NATIVE=OFF',
      '-DGGML_VULKAN=ON',
      '-DGGML_OPENMP=OFF',
      '-DWHISPER_BUILD_TESTS=OFF',
      '-DWHISPER_BUILD_SERVER=OFF'
    ],
    { env }
  )
  // Hepsi derlenir: CPU varyantları ve Vulkan backend'i whisper-cli'ye bağlı değil, çalışma anında yüklenir.
  run('cmake', ['--build', BUILD_DIR, '-j', String(availableParallelism())], { env })

  rmSync(BIN_DIR, { recursive: true, force: true })
  mkdirSync(BIN_DIR, { recursive: true })
  // Yalnızca whisper-cli'nin kullandıkları: build/bin'de başka örneklerin dll'leri de var (ör. parakeet.dll).
  const builtBin = join(BUILD_DIR, 'bin')
  for (const name of readdirSync(builtBin)) {
    if (/^(whisper-cli\.exe|whisper\.dll|ggml.*\.dll)$/i.test(name)) {
      copyFileSync(join(builtBin, name), join(BIN_DIR, name))
    }
  }

  const manifest = join(BUILD_DIR, 'utf8.manifest')
  writeFileSync(manifest, UTF8_MANIFEST)
  run('mt', ['-nologo', '-manifest', manifest, `-outputresource:${WIN_CLI_PATH};#1`], { env })

  return env
}

async function verifyWindows(env) {
  log('whisper-cli doğrulanıyor')
  const files = readdirSync(BIN_DIR)
  const bundled = new Set(files.map((name) => name.toLowerCase()))
  const problems = []
  for (const name of files) {
    const output = capture('dumpbin', ['/nologo', '/dependents', join(BIN_DIR, name)], { env })
    if (output === null) die(`dumpbin ${name} için çalışmadı.`)
    for (const [, dep] of output.matchAll(/^\s+(\S+\.dll)\s*$/gim)) {
      if (FORBIDDEN_DLL.test(dep)) problems.push(`${name} → ${dep} (VC++ runtime / OpenMP)`)
      else if (bundled.has(dep.toLowerCase()) || ALLOWED_EXTERNAL_DLL.test(dep)) continue
      else if (!existsSync(join(SYSTEM32, dep))) problems.push(`${name} → ${dep}`)
    }
  }
  if (problems.length > 0) die(`Sistem dışı bağımlılıklar var:\n${problems.join('\n')}`)

  verifyHelp(WIN_CLI_PATH)
  await smokeTestWindows()
  console.log(`Tamam: ${WIN_CLI_PATH} (+ ${files.length - 1} dll)`)
}

// Binary'ler ve girdiler ASCII dışı karakterli klasörlere kopyalanıp kısa bir kayıt transcribe edilir: dll'lerin
// böyle bir klasörden yüklenmesini ve UTF-8 manifest'inin yolları açmasını birlikte doğrular (per-user kurulumda
// uygulama da kullanıcı profilinin altında durur). Klasör adlarında Türkçe harflerin yanında Kiril harfi de var:
// manifest'siz whisper-cli Türkçe kod sayfalı (1254) bir sistemde ikisinde de dosyaları açamıyor.
async function smokeTestWindows() {
  log('Duman testi (ASCII dışı karakterli yollar)')
  const smokeModel = join(CACHE_DIR, 'smoke', SMOKE_MODEL_FILE)
  await downloadVerified({
    label: 'Duman testi modeli',
    url: `https://huggingface.co/${SMOKE_MODEL_REPO}/resolve/${SMOKE_MODEL_REVISION}/${SMOKE_MODEL_FILE}`,
    path: smokeModel,
    sha256: SMOKE_MODEL_SHA256
  })

  const dir = mkdtempSync(join(tmpdir(), 'meetanalyzing-çğış-'))
  try {
    const binDir = join(dir, 'uygulama-ç')
    const inputDir = join(dir, 'kayıtlar-ğ-ж')
    // Dosya dosya kopyalanır: Node 22'nin fs.cpSync'i Windows'ta ASCII dışı karakterli hedefte süreci düşürüyor.
    mkdirSync(binDir)
    for (const name of readdirSync(BIN_DIR)) copyFileSync(join(BIN_DIR, name), join(binDir, name))
    mkdirSync(inputDir)
    for (const file of [smokeModel, MODEL_PATH, join(SRC_DIR, 'samples', 'jfk.wav')]) {
      copyFileSync(file, join(inputDir, basename(file)))
    }

    const outputPrefix = join(inputDir, 'çıktı')
    const output = capture(join(binDir, 'whisper-cli.exe'), [
      '-m',
      join(inputDir, SMOKE_MODEL_FILE),
      '-f',
      join(inputDir, 'jfk.wav'),
      '-l',
      'en',
      '--vad',
      '--vad-model',
      join(inputDir, VAD_MODEL_FILE),
      '-ojf',
      '-of',
      outputPrefix,
      '-t',
      '2'
    ])
    if (output === null) die('whisper-cli ASCII dışı karakterli yollarla çalışmadı.')
    const jsonPath = `${outputPrefix}.json`
    if (!existsSync(jsonPath)) die('whisper-cli JSON çıktısını ASCII dışı karakterli yola yazmadı.')
    const text = JSON.parse(readFileSync(jsonPath, 'utf8'))
      .transcription.map((segment) => segment.text)
      .join('')
    if (!/country/i.test(text)) die(`Duman testinde beklenmeyen transcript: ${text}`)

    const backend = output.match(/using (\S+) backend/)?.[1] ?? 'CPU'
    console.log(`Transcript: ${text.trim()}`)
    console.log(`Backend: ${backend}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// --- Hedefler -----------------------------------------------------------------
const TARGETS = {
  'darwin-arm64': {
    cliPath: MAC_CLI_PATH,
    build: async () => buildMac()
  },
  'win32-x64': {
    cliPath: WIN_CLI_PATH,
    build: async () => verifyWindows(buildWindows())
  }
}

function currentTarget() {
  const target = TARGETS[TARGET]
  if (!target) die(`${TARGET} desteklenmiyor; desteklenenler: ${Object.keys(TARGETS).join(', ')}.`)
  return target
}

// --- Yalnızca doğrulama (--check) ---------------------------------------------
// Binary ya da VAD modeli olmadan paket üretilirse uygulama Transcription yapamaz;
// bu yüzden build:mac, build:win ve build:unpack bu kontrolü önce çalıştırır.
async function check() {
  const { cliPath } = currentTarget()
  if (!isExecutable(cliPath)) die(`${cliPath} yok. Önce 'pnpm build:whisper' çalıştır.`)
  if (!existsSync(MODEL_PATH)) die(`${MODEL_PATH} yok. Önce 'pnpm build:whisper' çalıştır.`)
  if ((await sha256Of(MODEL_PATH)) !== VAD_MODEL_SHA256) {
    die(`${VAD_MODEL_FILE} SHA-256 değeri uyuşmuyor. 'pnpm build:whisper' ile yeniden indir.`)
  }
  console.log('whisper kaynakları hazır.')
}

// --- Ana akış -----------------------------------------------------------------
async function build() {
  const target = currentTarget()
  // VAD modeli önce: Windows duman testi onu kullanır.
  log(`VAD modeli (${VAD_MODEL_FILE}) hazırlanıyor`)
  await downloadVerified({
    label: 'VAD modeli',
    url: `https://huggingface.co/${VAD_MODEL_REPO}/resolve/${VAD_MODEL_REVISION}/${VAD_MODEL_FILE}`,
    path: MODEL_PATH,
    sha256: VAD_MODEL_SHA256
  })
  await target.build()
  log('Bitti')
}

try {
  await (process.argv[2] === '--check' ? check() : build())
} catch (error) {
  if (!(error instanceof BuildError)) throw error
  console.error(`HATA: ${error.message}`)
  process.exitCode = 1
}
