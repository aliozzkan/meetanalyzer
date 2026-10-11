import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync
} from 'node:fs'
import { dirname } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ModelErrorCode } from '../../shared/model'

const NETWORK_MESSAGE = 'İndirme kesildi. İnternet bağlantını kontrol edip yeniden dene.'

export class ModelDownloadError extends Error {
  constructor(
    readonly code: ModelErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ModelDownloadError'
  }
}

export interface DownloadProgress {
  receivedBytes: number
  totalBytes: number
}

export interface DownloadModelOptions {
  url: string
  /** Kurulu modelin son yolu; indirme `<destPath>.part` dosyasına yazılır. */
  destPath: string
  expectedSha256: string
  expectedSize: number
  /** Başlamadan önce gereken en az boş alan (bayt). */
  minFreeBytes: number
  freeBytes: () => number
  onProgress?: (progress: DownloadProgress) => void
  /** İptal edilirse indirme durur ve AbortError fırlatılır; .part korunur. */
  signal?: AbortSignal
}

export async function downloadModel(options: DownloadModelOptions): Promise<void> {
  const { destPath, expectedSha256, expectedSize } = options
  const partPath = `${destPath}.part`
  mkdirSync(dirname(destPath), { recursive: true })

  // Beklenenden büyük .part geçersizdir (devam ettirilemez); baştan başlanır.
  if (existsSync(partPath) && statSync(partPath).size > expectedSize) rmSync(partPath)

  // .part tamsa ağa hiç gidilmez; yalnızca doğrulanır.
  if (partSize(partPath) < expectedSize) {
    assertEnoughSpace(options, expectedSize - partSize(partPath))
    await fetchInto(partPath, options)
  }

  if ((await sha256Of(partPath, options.signal)) !== expectedSha256) {
    rmSync(partPath, { force: true }) // bozuk dosya yeniden denemede kaldığı yerden devam ettirilemez
    throw new ModelDownloadError('hash-mismatch', 'İndirilen dosya doğrulanamadı.')
  }
  renameSync(partPath, destPath)
}

function partSize(partPath: string): number {
  return existsSync(partPath) ? statSync(partPath).size : 0
}

// Gereken alan, ayarlanan en az boş alan ile kalan indirme miktarından büyük olanıdır.
function assertEnoughSpace(options: DownloadModelOptions, remainingBytes: number): void {
  const required = Math.max(options.minFreeBytes, remainingBytes)
  const free = options.freeBytes()
  if (free < required) {
    throw new ModelDownloadError(
      'insufficient-space',
      `Yeterli boş alan yok: ${Math.ceil(required / 1024 ** 2)} MB gerekiyor, ${Math.floor(free / 1024 ** 2)} MB var.`
    )
  }
}

// Eksik kısmı (Range ile) indirip .part dosyasına ekler. Ağ hataları `network` olarak sınıflandırılır;
// o ana kadar yazılan kısım korunur, böylece sonraki deneme kaldığı yerden devam eder.
async function fetchInto(
  partPath: string,
  options: DownloadModelOptions,
  mayRestart = true
): Promise<void> {
  const { url, expectedSize, onProgress, signal } = options
  const partialBytes = partSize(partPath)
  try {
    const response = await fetch(url, {
      headers: partialBytes > 0 ? { Range: `bytes=${partialBytes}-` } : {},
      signal
    })

    // 416 ya da yanlış kaymış bir 206: sunucu devam edilen kısmı kabul etmedi (dosya değişmiş olabilir);
    // .part geçersizdir, bir kez baştan denenir.
    if (isUnusableResume(response, partialBytes, expectedSize) && mayRestart) {
      await response.body?.cancel()
      rmSync(partPath, { force: true })
      return await fetchInto(partPath, options, false)
    }
    if (!response.ok || isUnusableResume(response, partialBytes, expectedSize)) {
      throw new ModelDownloadError('http-error', `Sunucu ${response.status} yanıtı verdi.`)
    }
    if (!response.body) throw new ModelDownloadError('network', NETWORK_MESSAGE)

    // Sunucu tam içeriği başlıkta bildiriyorsa ve beklenenden farklıysa hiç indirmeden reddedilir.
    const declared = Number(response.headers.get('content-length'))
    if (response.status === 200 && declared > 0 && declared !== expectedSize) {
      throw new ModelDownloadError(
        'unexpected-size',
        'Sunucu beklenenden farklı boyutta dosya sundu.'
      )
    }

    // 206: sunucu Range'i kabul etti, kaldığımız yerden eklenir. Aksi halde (200) tam içerik gelir: baştan yazılır.
    const resuming = response.status === 206
    let receivedBytes = resuming ? partialBytes : 0
    await pipeline(
      Readable.fromWeb(response.body as never),
      new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          receivedBytes += chunk.length
          // Akış beklenen boyutu aşarsa kesilir: yanlış davranan bir sunucu diski dolduramaz.
          if (receivedBytes > expectedSize) {
            callback(
              new ModelDownloadError(
                'unexpected-size',
                'Sunucu beklenenden büyük bir dosya gönderdi.'
              )
            )
            return
          }
          onProgress?.({ receivedBytes, totalBytes: expectedSize })
          callback(null, chunk)
        }
      }),
      createWriteStream(partPath, { flags: resuming ? 'a' : 'w' }),
      { signal }
    )
  } catch (error) {
    if (error instanceof ModelDownloadError) {
      if (error.code === 'unexpected-size') rmSync(partPath, { force: true })
      throw error
    }
    if (signal?.aborted) throw error
    console.error('Model indirme ağ hatası:', error) // teknik ayrıntı kullanıcıya gösterilmez
    throw new ModelDownloadError('network', NETWORK_MESSAGE)
  }

  // Sunucu hata vermeden erken bitirdiyse dosya eksiktir: kabul edilmez, kaldığı yerden devam edilebilir.
  const size = partSize(partPath)
  if (size < expectedSize) {
    throw new ModelDownloadError('network', 'İndirme erken bitti; dosya eksik.')
  }
  if (size > expectedSize) {
    rmSync(partPath, { force: true })
    throw new ModelDownloadError('unexpected-size', 'Sunucu beklenenden büyük bir dosya gönderdi.')
  }
}

// 416, ya da istenen konumdan başlamayan/farklı toplam boyutlu bir 206: devam edilen kısım kullanılamaz.
function isUnusableResume(response: Response, partialBytes: number, expectedSize: number): boolean {
  if (partialBytes === 0) return false
  if (response.status === 416) return true
  if (response.status !== 206) return false
  const match = /^bytes (\d+)-\d+\/(\d+)$/.exec(response.headers.get('content-range') ?? '')
  return !match || Number(match[1]) !== partialBytes || Number(match[2]) !== expectedSize
}

async function sha256Of(file: string, signal?: AbortSignal): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(file), hash, { signal })
  return hash.digest('hex')
}
