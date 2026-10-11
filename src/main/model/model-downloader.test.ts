import { createHash, randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { downloadModel, type DownloadModelOptions } from './model-downloader'

// --- Gerçek bir yerel HTTP sunucusu: Range, 206, 416 ve bağlantı kesme davranışlarıyla -------------

interface Behavior {
  /** Range başlığını yok sayar ve her zaman 200 ile tam içerik verir. */
  ignoreRange?: boolean
  /** İstenen aralığın yalnızca ilk n baytını gönderip bağlantıyı koparır. */
  cutAfter?: number
  /** Her isteğe bu durum koduyla boş yanıt verir. */
  status?: number
  /** Range'li her isteğe 416 verir (dosya değişmiş gibi). */
  rangeNotSatisfiable?: boolean
  /** İçeriği yalnızca ilk n bayttan sonra, Content-Length'siz ve hatasız bitirir (erken kapanış). */
  endEarlyAt?: number
  /** 206 yanıtında Content-Range başlangıcını kaydırır (sunucu yanlış yerden devam ettirir). */
  wrongContentRange?: boolean
  /** Gövdenin sonuna bu kadar ek bayt ekler (sınırsız/aşırı akış testi). */
  extraBytes?: number
  /** extraBytes ile birlikte Content-Length da bildirilir (varsayılan: chunked, başlıksız). */
  declareLength?: boolean
  /** Gövdeyi 20 KB'lık parçalarla, aralarında gecikmeyle yollar (iptal testi için). */
  slow?: boolean
}

interface TestServer {
  url: string
  ranges: (string | undefined)[]
}

const servers: Server[] = []
const tempDirs: string[] = []
afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise((r) => server.close(r))
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

async function serve(body: Buffer, behavior: Behavior = {}): Promise<TestServer> {
  const ranges: (string | undefined)[] = []
  const server = createServer((req, res) => {
    ranges.push(req.headers.range)
    if (behavior.status) {
      res.writeHead(behavior.status).end()
      return
    }
    const rangeHeader = req.headers.range
    if (rangeHeader && behavior.rangeNotSatisfiable) {
      res.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end()
      return
    }
    const match = /^bytes=(\d+)-$/.exec(rangeHeader ?? '')
    const start = match && !behavior.ignoreRange ? Number(match[1]) : 0
    if (match && !behavior.ignoreRange && start >= body.length) {
      res.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end()
      return
    }

    const payload = behavior.extraBytes
      ? Buffer.concat([body.subarray(start), Buffer.alloc(behavior.extraBytes, 1)])
      : body.subarray(start)
    const headers: Record<string, string | number> = {}
    if (start > 0) {
      const shown = behavior.wrongContentRange ? start + 7 : start
      headers['Content-Range'] = `bytes ${shown}-${body.length - 1}/${body.length}`
    }
    // Erken bitiş, yavaş akış ve (declareLength olmadan) aşırı akış chunked gönderilir: Content-Length yok.
    const chunked =
      behavior.endEarlyAt !== undefined ||
      behavior.slow ||
      (behavior.extraBytes !== undefined && !behavior.declareLength)
    if (!chunked) headers['Content-Length'] = payload.length
    res.writeHead(start > 0 ? 206 : 200, headers)

    if (behavior.endEarlyAt !== undefined) {
      res.end(payload.subarray(0, behavior.endEarlyAt))
    } else if (behavior.slow) {
      let sent = 0
      const timer = setInterval(() => {
        if (sent >= payload.length || res.destroyed) {
          clearInterval(timer)
          res.end()
          return
        }
        res.write(payload.subarray(sent, sent + 20_000))
        sent += 20_000
      }, 15)
      res.on('close', () => clearInterval(timer))
    } else if (behavior.cutAfter !== undefined) {
      res.write(payload.subarray(0, behavior.cutAfter))
      setTimeout(() => res.destroy(), 20)
    } else {
      res.end(payload)
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  servers.push(server)
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/model.bin`, ranges }
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

const MODEL = randomBytes(300_000)

function setup(): { destPath: string; partPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'meetanalyzing-model-'))
  tempDirs.push(dir)
  const destPath = join(dir, 'models', 'model.bin')
  return { destPath, partPath: `${destPath}.part` }
}

function writePart(partPath: string, data: Buffer): void {
  mkdirSync(dirname(partPath), { recursive: true })
  writeFileSync(partPath, data)
}

function options(
  url: string,
  destPath: string,
  overrides: Partial<DownloadModelOptions> = {}
): DownloadModelOptions {
  return {
    url,
    destPath,
    expectedSha256: sha256(MODEL),
    expectedSize: MODEL.length,
    minFreeBytes: 0,
    freeBytes: () => Number.MAX_SAFE_INTEGER,
    ...overrides
  }
}

describe('downloadModel', () => {
  it('modeli indirir, hash’ini doğrular ve .part dosyasını atomik olarak yerine alır', async () => {
    const server = await serve(MODEL)
    const { destPath, partPath } = setup()
    const progress: number[] = []

    await downloadModel({
      ...options(server.url, destPath),
      onProgress: ({ receivedBytes, totalBytes }) => {
        expect(totalBytes).toBe(MODEL.length)
        progress.push(receivedBytes)
      }
    })

    expect(readFileSync(destPath).equals(MODEL)).toBe(true)
    expect(existsSync(partPath)).toBe(false)
    expect(server.ranges).toEqual([undefined]) // ilk indirmede Range yok
    expect(progress.at(-1)).toBe(MODEL.length)
    expect(progress).toEqual([...progress].sort((a, b) => a - b)) // ilerleme geri gitmez
    expect(statSync(destPath).size).toBe(MODEL.length)
  })

  it('hash uyuşmazlığında dosya reddedilir: .part silinir, hedef oluşmaz', async () => {
    const corrupted = Buffer.from(MODEL)
    corrupted[corrupted.length - 1] ^= 0xff // tek bayt bozuk
    const server = await serve(corrupted)
    const { destPath, partPath } = setup()

    await expect(downloadModel(options(server.url, destPath))).rejects.toMatchObject({
      code: 'hash-mismatch'
    })

    expect(existsSync(destPath)).toBe(false)
    expect(existsSync(partPath)).toBe(false)
  })

  it('yarım .part varsa Range ile kaldığı yerden devam eder ve ilerleme baştan sayılır', async () => {
    const server = await serve(MODEL)
    const { destPath, partPath } = setup()
    writePart(partPath, MODEL.subarray(0, 100_000))
    const first: number[] = []

    await downloadModel({
      ...options(server.url, destPath),
      onProgress: ({ receivedBytes }) => first.push(receivedBytes)
    })

    expect(server.ranges).toEqual(['bytes=100000-'])
    expect(readFileSync(destPath).equals(MODEL)).toBe(true)
    expect(existsSync(partPath)).toBe(false)
    expect(first[0]).toBeGreaterThan(100_000) // devam eden indirmede ilerleme zaten gelen baytlarla başlar
    expect(first.at(-1)).toBe(MODEL.length)
  })

  it('sunucu Range’i yok sayıp tam içerik (200) verirse baştan indirir; sonuç doğru olur', async () => {
    const server = await serve(MODEL, { ignoreRange: true })
    const { destPath, partPath } = setup()
    writePart(partPath, MODEL.subarray(0, 100_000))

    await downloadModel(options(server.url, destPath))

    expect(server.ranges).toEqual(['bytes=100000-']) // istendi ama yok sayıldı
    expect(readFileSync(destPath).equals(MODEL)).toBe(true) // eski kısım çift yazılmadı
  })

  it('.part zaten tamsa istek atmadan doğrulayıp yerine alır', async () => {
    const server = await serve(MODEL)
    const { destPath, partPath } = setup()
    writePart(partPath, MODEL)

    await downloadModel(options(server.url, destPath))

    expect(server.ranges).toEqual([])
    expect(readFileSync(destPath).equals(MODEL)).toBe(true)
  })

  it('.part beklenenden büyükse (geçersiz) silinip baştan indirilir', async () => {
    const server = await serve(MODEL)
    const { destPath, partPath } = setup()
    writePart(partPath, Buffer.concat([MODEL, Buffer.from('artık')]))

    await downloadModel(options(server.url, destPath))

    expect(server.ranges).toEqual([undefined]) // Range yok: baştan
    expect(readFileSync(destPath).equals(MODEL)).toBe(true)
  })

  it('akış ortasında kesilirse .part korunur; ikinci çağrı kaldığı yerden bitirir', async () => {
    const { destPath, partPath } = setup()
    const flaky = await serve(MODEL, { cutAfter: 120_000 })

    await expect(downloadModel(options(flaky.url, destPath))).rejects.toMatchObject({
      code: 'network'
    })
    const kept = statSync(partPath).size
    expect(kept).toBeGreaterThan(0)
    expect(kept).toBeLessThan(MODEL.length)
    expect(existsSync(destPath)).toBe(false)

    const healthy = await serve(MODEL)
    await downloadModel(options(healthy.url, destPath))

    expect(healthy.ranges).toEqual([`bytes=${kept}-`])
    expect(readFileSync(destPath).equals(MODEL)).toBe(true)
  })

  it('yetersiz boş alanda hiç istek atılmaz ve .part oluşmaz', async () => {
    const server = await serve(MODEL)
    const { destPath, partPath } = setup()

    await expect(
      downloadModel(
        options(server.url, destPath, { minFreeBytes: 1_000_000, freeBytes: () => 999_999 })
      )
    ).rejects.toMatchObject({ code: 'insufficient-space' })

    expect(server.ranges).toEqual([])
    expect(existsSync(partPath)).toBe(false)
  })

  it('kalan miktar eşikten büyükse onu esas alır; yarım .part’a dokunmaz', async () => {
    const server = await serve(MODEL)
    const { destPath, partPath } = setup()
    writePart(partPath, MODEL.subarray(0, 100_000)) // kalan 200 000 bayt

    // Eşik 1 bayt ama boş alan kalandan (200 000) az
    await expect(
      downloadModel(options(server.url, destPath, { minFreeBytes: 1, freeBytes: () => 150_000 }))
    ).rejects.toMatchObject({ code: 'insufficient-space' })

    expect(statSync(partPath).size).toBe(100_000)
    expect(server.ranges).toEqual([])
  })

  it('HTTP hatasında (404) http-error verir ve .part oluşturmaz', async () => {
    const server = await serve(MODEL, { status: 404 })
    const { destPath, partPath } = setup()

    await expect(downloadModel(options(server.url, destPath))).rejects.toMatchObject({
      code: 'http-error'
    })

    expect(existsSync(partPath)).toBe(false)
  })

  it('devam isteği 416 alırsa .part geçersiz sayılır: silinir ve baştan indirilir', async () => {
    const server = await serve(MODEL, { rangeNotSatisfiable: true })
    const { destPath, partPath } = setup()
    writePart(partPath, MODEL.subarray(0, 100_000))

    await downloadModel(options(server.url, destPath))

    expect(server.ranges).toEqual(['bytes=100000-', undefined])
    expect(readFileSync(destPath).equals(MODEL)).toBe(true)
  })

  it('sunucu içeriği erken bitirirse eksik dosya kabul edilmez; .part korunur', async () => {
    const server = await serve(MODEL, { endEarlyAt: 120_000 })
    const { destPath, partPath } = setup()

    await expect(downloadModel(options(server.url, destPath))).rejects.toMatchObject({
      code: 'network'
    })

    expect(existsSync(destPath)).toBe(false)
    expect(statSync(partPath).size).toBe(120_000)
  })

  it('iptal edilirse indirme durur ve .part korunur', async () => {
    const server = await serve(MODEL, { slow: true })
    const { destPath, partPath } = setup()
    const controller = new AbortController()

    const download = downloadModel({
      ...options(server.url, destPath),
      signal: controller.signal,
      onProgress: ({ receivedBytes }) => {
        if (receivedBytes >= 40_000) controller.abort()
      }
    })

    await expect(download).rejects.toMatchObject({ name: 'AbortError' })
    expect(existsSync(destPath)).toBe(false)
    expect(statSync(partPath).size).toBeGreaterThan(0)
    expect(statSync(partPath).size).toBeLessThan(MODEL.length)
  })

  it('sunucu beklenenden fazla bayt gönderirse unexpected-size verir ve .part silinir', async () => {
    const server = await serve(Buffer.concat([MODEL, Buffer.from('fazladan')]))
    const { destPath, partPath } = setup()

    await expect(downloadModel(options(server.url, destPath))).rejects.toMatchObject({
      code: 'unexpected-size'
    })

    expect(existsSync(destPath)).toBe(false)
    expect(existsSync(partPath)).toBe(false)
  })

  it('206 yanıtında Content-Range istenen konumla uyuşmuyorsa .part geçersiz sayılıp baştan indirilir', async () => {
    const server = await serve(MODEL, { wrongContentRange: true })
    const { destPath, partPath } = setup()
    writePart(partPath, MODEL.subarray(0, 100_000))

    await downloadModel(options(server.url, destPath))

    expect(server.ranges).toEqual(['bytes=100000-', undefined]) // yanlış kayma fark edilip baştan
    expect(readFileSync(destPath).equals(MODEL)).toBe(true)
  })

  it('sunucu çok fazla bayt gönderirse akış beklenen boyutta kesilir (disk dolmaz)', async () => {
    const server = await serve(MODEL, { extraBytes: 5_000_000 })
    const { destPath, partPath } = setup()
    let mostReceived = 0

    await expect(
      downloadModel({
        ...options(server.url, destPath),
        onProgress: ({ receivedBytes }) => (mostReceived = Math.max(mostReceived, receivedBytes))
      })
    ).rejects.toMatchObject({ code: 'unexpected-size' })

    expect(mostReceived).toBeLessThan(MODEL.length + 1_000_000) // 5 MB'ın tamamı alınmadı
    expect(existsSync(partPath)).toBe(false)
  })

  it('hash doğrulaması iptal edilebilir: AbortError verir, tam .part korunur', async () => {
    const server = await serve(MODEL)
    const { destPath, partPath } = setup()
    writePart(partPath, MODEL) // tam .part: yalnızca doğrulama kalmış
    const controller = new AbortController()
    controller.abort()

    await expect(
      downloadModel({ ...options(server.url, destPath), signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(existsSync(destPath)).toBe(false)
    expect(statSync(partPath).size).toBe(MODEL.length)
  })

  it('ağ hatası kullanıcıya anlaşılır Türkçe bir mesajla bildirilir (ham hata sızmaz)', async () => {
    const server = await serve(MODEL, { cutAfter: 50_000 })
    const { destPath } = setup()

    const error = await downloadModel(options(server.url, destPath)).catch((e) => e)

    expect(error.code).toBe('network')
    expect(error.message).toBe('İndirme kesildi. İnternet bağlantını kontrol edip yeniden dene.')
  })

  it('sunucu Content-Length ile beklenenden farklı boyut bildirirse hiç indirmeden reddedilir', async () => {
    const server = await serve(MODEL, { extraBytes: 5_000_000, declareLength: true })
    const { destPath, partPath } = setup()
    let received = 0

    await expect(
      downloadModel({
        ...options(server.url, destPath),
        onProgress: ({ receivedBytes }) => (received = receivedBytes)
      })
    ).rejects.toMatchObject({ code: 'unexpected-size' })

    expect(received).toBe(0)
    expect(existsSync(partPath)).toBe(false)
  })
})
