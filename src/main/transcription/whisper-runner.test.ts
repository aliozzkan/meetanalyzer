import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runWhisper, type RunWhisperOptions } from './whisper-runner'

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'meetanalyzing-runner-'))
  tempDirs.push(dir)
  return dir
}

// Sahte whisper-cli: -of önekini bulup $PREFIX'e koyar, ardından verilen kabuk gövdesini çalıştırır.
// Gövdedeki {{DIR}}, testin geçici klasörüyle değiştirilir (betiğin test için dosya yazması gerekirse).
function fakeWhisper(dir: string, body: string): string {
  const path = join(dir, 'whisper-cli')
  writeFileSync(
    path,
    `#!/bin/sh
PREFIX=""
while [ $# -gt 0 ]; do
  if [ "$1" = "-of" ]; then PREFIX="$2"; fi
  shift
done
${body.replaceAll('{{DIR}}', dir)}
`
  )
  chmodSync(path, 0o755)
  return path
}

// Koşul sağlanana kadar kısa aralıklarla bekler (sabit uyku yerine); zaman aşımında hata verir.
async function waitFor(condition: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('koşul zamanında gerçekleşmedi')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const OK_JSON = '{"transcription":[]}'

function setup(body: string): { options: RunWhisperOptions; dir: string; workDir: string } {
  const dir = tempDir()
  const workDir = tempDir() // runner'ın geçici çıktı klasörü buraya açılır; iş bitince boş olmalı
  writeFileSync(join(dir, 'vad.bin'), 'vad')
  writeFileSync(join(dir, 'model.bin'), 'model')
  writeFileSync(join(dir, 'a.wav'), 'wav')
  return {
    dir,
    workDir,
    options: {
      cliPath: fakeWhisper(dir, body),
      modelPath: join(dir, 'model.bin'),
      vadModelPath: join(dir, 'vad.bin'),
      wavPath: join(dir, 'a.wav'),
      language: 'tr',
      threads: 2,
      nice: 10,
      tempRoot: workDir
    }
  }
}

describe('runWhisper', () => {
  it('whisper’ı çalıştırır; JSON çıktısını ve stderr’i döndürür, ilerlemeyi yayınlar, geçici dosyayı siler', async () => {
    const { options, workDir } = setup(`
echo "whisper_vad: vad_segment_info: orig_start: 1.00, orig_end: 2.00, vad_start: 0.00, vad_end: 1.00" >&2
echo "whisper_print_progress_callback: progress = 25%" >&2
sleep 0.2
echo "whisper_print_progress_callback: progress = 100%" >&2
echo '${OK_JSON}' > "$PREFIX.json"
`)
    const progress: number[] = []

    const result = await runWhisper({ ...options, onProgress: (percent) => progress.push(percent) })

    expect(result.json).toEqual({ transcription: [] })
    expect(result.stderr).toContain('vad_segment_info: orig_start: 1.00')
    expect(progress).toEqual([25, 100])
    expect(readdirSync(workDir)).toEqual([]) // geçici klasör temizlendi
  })

  it('bir satır iki parçada gelse de ilerleme doğru okunur', async () => {
    const { options } = setup(`
printf 'whisper_print_progress_callback: progress =' >&2
sleep 0.2
printf ' 42%%\\n' >&2
echo '${OK_JSON}' > "$PREFIX.json"
`)
    const progress: number[] = []

    await runWhisper({ ...options, onProgress: (percent) => progress.push(percent) })

    expect(progress).toEqual([42])
  })

  it('sıfırdan farklı çıkış kodunu anlaşılır bir hatayla bildirir ve geçici dosyayı siler', async () => {
    const { options, workDir } = setup(`
echo "failed to load model" >&2
exit 3
`)

    await expect(runWhisper(options)).rejects.toMatchObject({ code: 'whisper-failed' })
    expect(readdirSync(workDir)).toEqual([])
  })

  it('binary ya da VAD modeli yoksa "pnpm build:whisper çalıştır" der', async () => {
    const { options } = setup(`echo '${OK_JSON}' > "$PREFIX.json"`)

    await expect(runWhisper({ ...options, cliPath: '/yok/whisper-cli' })).rejects.toMatchObject({
      code: 'whisper-missing',
      message: expect.stringContaining('pnpm build:whisper')
    })
    await expect(runWhisper({ ...options, vadModelPath: '/yok/vad.bin' })).rejects.toMatchObject({
      code: 'whisper-missing',
      message: expect.stringContaining('pnpm build:whisper')
    })
  })

  it('JSON üretilmediyse ya da bozuksa invalid-output verir', async () => {
    const noJson = setup('exit 0')
    await expect(runWhisper(noJson.options)).rejects.toMatchObject({ code: 'invalid-output' })

    const broken = setup(`echo '{bozuk' > "$PREFIX.json"`)
    await expect(runWhisper(broken.options)).rejects.toMatchObject({ code: 'invalid-output' })
  })

  it('düşük öncelikle (nice) çalıştırılır', async () => {
    // Betik, önceliği ayarlanana kadar (nice 0'dan farklı olana kadar) bekleyip değeri yazar.
    const { options, dir } = setup(`
for i in $(seq 1 100); do
  NICE=$(ps -o nice= -p $$ | tr -d ' ')
  [ "$NICE" != "0" ] && break
  sleep 0.05
done
echo "$NICE" > "{{DIR}}/nice.txt"
echo '${OK_JSON}' > "$PREFIX.json"
`)

    await runWhisper(options)

    expect(readFileSync(join(dir, 'nice.txt'), 'utf8').trim()).toBe('10')
  })

  it('iptal edilirse süreç öldürülür, cancelled hatası verilir, geçici dosya silinir', async () => {
    const { options, dir, workDir } = setup(`
echo $$ > "{{DIR}}/pid.txt"
echo "whisper_print_progress_callback: progress = 5%" >&2
exec sleep 30
`)
    const controller = new AbortController()
    const started = Date.now()

    const run = runWhisper({
      ...options,
      signal: controller.signal,
      onProgress: () => controller.abort() // ilk ilerlemede iptal
    })

    await expect(run).rejects.toMatchObject({ code: 'cancelled' })
    expect(Date.now() - started).toBeLessThan(1_500) // SIGTERM hemen etkili oldu; 2 sn'lik SIGKILL yedeği beklenmedi
    const pid = Number(readFileSync(join(dir, 'pid.txt'), 'utf8').trim())
    await waitFor(() => {
      try {
        process.kill(pid, 0)
        return false
      } catch {
        return true // süreç artık yok
      }
    })
    expect(readdirSync(workDir)).toEqual([])
  })

  it('başlamadan önce iptal edilmiş sinyalle hiç çalıştırmaz', async () => {
    const { options, dir } = setup('touch "{{DIR}}/ran.txt"')
    const controller = new AbortController()
    controller.abort()

    await expect(runWhisper({ ...options, signal: controller.signal })).rejects.toMatchObject({
      code: 'cancelled'
    })
    expect(existsSync(join(dir, 'ran.txt'))).toBe(false)
  })
})
