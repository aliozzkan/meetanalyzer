import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { setPriority, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Language } from '../../shared/meeting'
import { TranscriptionError } from './errors'
import { buildWhisperArgs } from './whisper-args'
import { findProgress } from './whisper-parser'

export interface RunWhisperOptions {
  cliPath: string
  modelPath: string
  vadModelPath: string
  wavPath: string
  language: Language
  threads: number
  /** İşlem önceliği (nice): eşzamanlı Recording ve toplantı uygulaması takılmasın diye yüksek (düşük öncelik). */
  nice: number
  onProgress?: (percent: number) => void
  /** İptal edilirse process öldürülür ve `cancelled` hatası verilir. */
  signal?: AbortSignal
  /** Geçici çıktı klasörünün açılacağı yer (varsayılan: sistem geçici klasörü). */
  tempRoot?: string
}

export interface WhisperRun {
  /** whisper'ın -ojf çıktısı (henüz doğrulanmamış). */
  json: unknown
  /** Tam stderr: VAD segment bilgisini ve ilerlemeyi içerir. */
  stderr: string
}

const BUILD_HINT = "Önce 'pnpm build:whisper' çalıştır."
const KILL_GRACE_MS = 2_000

// whisper-cli'yi (sidecar, ADR-0004) çalıştırır. Process düşük öncelikli başlatılır ve iptal edilince öldürülür.
// Geçici çıktı klasörü her durumda silinir.
export async function runWhisper(options: RunWhisperOptions): Promise<WhisperRun> {
  const { signal } = options
  if (signal?.aborted) throw cancelled()
  assertFilesExist(options)

  const workDir = mkdtempSync(join(options.tempRoot ?? tmpdir(), 'meetanalyzing-whisper-'))
  try {
    const outputPrefix = join(workDir, 'out')
    const stderr = await execute(options, outputPrefix)
    return { json: readJson(`${outputPrefix}.json`), stderr }
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

function cancelled(): TranscriptionError {
  return new TranscriptionError('cancelled', 'Transcription iptal edildi.')
}

function assertFilesExist({ cliPath, vadModelPath, modelPath }: RunWhisperOptions): void {
  const missing = (label: string, path: string): TranscriptionError =>
    new TranscriptionError('whisper-missing', `${label} bulunamadı (${path}). ${BUILD_HINT}`)
  if (!existsSync(cliPath)) throw missing('whisper-cli', cliPath)
  if (!existsSync(vadModelPath)) throw missing('VAD modeli', vadModelPath)
  if (!existsSync(modelPath)) {
    throw new TranscriptionError('whisper-missing', 'Transcription modeli indirilmemiş.')
  }
}

function execute(options: RunWhisperOptions, outputPrefix: string): Promise<string> {
  const { signal, onProgress } = options
  const args = buildWhisperArgs({
    modelPath: options.modelPath,
    wavPath: options.wavPath,
    language: options.language,
    vadModelPath: options.vadModelPath,
    outputPrefix,
    threads: options.threads
  })

  return new Promise((resolve, reject) => {
    const child = spawn(options.cliPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    if (child.pid !== undefined) {
      try {
        setPriority(child.pid, options.nice)
      } catch (error) {
        console.error('whisper önceliği ayarlanamadı:', error) // çalışmaya devam eder, yalnızca daha öncelikli olur
      }
    }

    let stderr = ''
    let scanned = 0
    child.stdout.resume() // yazdığı metin kullanılmaz (çıktı JSON dosyasındadır); tampon dolmasın
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
      for (const { percent, end } of findProgress(stderr, scanned)) {
        scanned = end
        onProgress?.(percent)
      }
    })

    let killTimer: ReturnType<typeof setTimeout> | undefined
    const onAbort = (): void => {
      child.kill('SIGTERM')
      killTimer = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    const cleanup = (): void => {
      signal?.removeEventListener('abort', onAbort)
      clearTimeout(killTimer)
    }

    child.on('error', (error) => {
      cleanup()
      reject(
        new TranscriptionError(
          'whisper-failed',
          `whisper-cli başlatılamadı: ${error.message}. ${BUILD_HINT}`
        )
      )
    })
    // İptalde süreç çıkınca beklemeden sonuçlanır: yetim bir alt süreç borulara tutunup `close`u geciktirmesin.
    child.on('exit', () => {
      if (signal?.aborted) {
        cleanup()
        reject(cancelled())
      }
    })
    child.on('close', (code) => {
      cleanup()
      if (signal?.aborted) {
        reject(cancelled())
      } else if (code !== 0) {
        console.error(
          `whisper-cli ${code} koduyla çıktı. stderr (son satırlar):\n${stderr.slice(-2_000)}`
        )
        reject(
          new TranscriptionError(
            'whisper-failed',
            `Transcription başarısız oldu (whisper-cli çıkış kodu ${code}).`
          )
        )
      } else {
        resolve(stderr)
      }
    })
  })
}

function readJson(path: string): unknown {
  if (!existsSync(path)) {
    throw new TranscriptionError('invalid-output', 'whisper çıktı dosyası üretmedi.')
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    throw new TranscriptionError('invalid-output', 'whisper çıktısı okunamadı (bozuk JSON).')
  }
}
