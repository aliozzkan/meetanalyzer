import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ModelState } from '../../shared/model'
import { ModelDownloadError } from './model-downloader'
import { createModelService, type ModelService } from './model-service'

const EXPECTED_SIZE = 1_000

const tempDirs: string[] = []
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

// Elle kontrol edilen sahte indirici: her çağrı bir "bekleyen indirme" oluşturur.
interface PendingDownload {
  progress: (receivedBytes: number) => void
  succeed: () => void
  fail: (error: Error) => void
  signal: AbortSignal | undefined
}

function setup(): {
  service: ModelService
  modelPath: string
  states: ModelState[]
  downloads: PendingDownload[]
} {
  const dir = mkdtempSync(join(tmpdir(), 'meetanalyzing-modelsvc-'))
  tempDirs.push(dir)
  const modelPath = join(dir, 'model.bin')
  const states: ModelState[] = []
  const downloads: PendingDownload[] = []
  const service = createModelService({
    modelPath,
    expectedSize: EXPECTED_SIZE,
    onState: (state) => states.push(state),
    download: ({ onProgress, signal }) =>
      new Promise<void>((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason))
        downloads.push({
          progress: (receivedBytes) => onProgress({ receivedBytes, totalBytes: EXPECTED_SIZE }),
          succeed: () => {
            writeFileSync(modelPath, Buffer.alloc(EXPECTED_SIZE)) // başarılı indirme dosyayı yerine koyar
            resolve()
          },
          fail: reject,
          signal
        })
      })
  })
  return { service, modelPath, states, downloads }
}

describe('Model servisi', () => {
  it('başlangıç durumu diskten gelir: eksik, yarım indirme ya da hazır', () => {
    const empty = setup()
    expect(empty.service.getState()).toEqual({ status: 'missing', partialBytes: 0 })

    const partial = setup()
    writeFileSync(`${partial.modelPath}.part`, Buffer.alloc(300))
    expect(createFresh(partial.modelPath).getState()).toEqual({
      status: 'missing',
      partialBytes: 300
    })

    const ready = setup()
    writeFileSync(ready.modelPath, Buffer.alloc(EXPECTED_SIZE))
    expect(createFresh(ready.modelPath).getState()).toEqual({ status: 'ready' })

    const truncated = setup() // beklenen boyutta olmayan dosya kurulu sayılmaz
    writeFileSync(truncated.modelPath, Buffer.alloc(EXPECTED_SIZE - 1))
    expect(createFresh(truncated.modelPath).getState()).toEqual({
      status: 'missing',
      partialBytes: 0
    })
  })

  it('start iki kez çağrılırsa tek indirme çalışır; ilerleme ve başarı duruma yansır', async () => {
    const { service, states, downloads } = setup()

    const first = service.start()
    const second = service.start()
    expect(downloads).toHaveLength(1)

    downloads[0].progress(400)
    expect(service.getState()).toEqual({
      status: 'downloading',
      receivedBytes: 400,
      totalBytes: EXPECTED_SIZE
    })

    downloads[0].succeed()
    await Promise.all([first, second])

    expect(service.getState()).toEqual({ status: 'ready' })
    expect(states.map((state) => state.status)).toEqual(['downloading', 'downloading', 'ready'])
  })

  it('model zaten hazırsa start indirme başlatmaz', async () => {
    const { service, modelPath, downloads } = setup()
    writeFileSync(modelPath, Buffer.alloc(EXPECTED_SIZE))
    const ready = createModelService({
      modelPath,
      expectedSize: EXPECTED_SIZE,
      download: () => {
        downloads.push(null as never)
        return Promise.resolve()
      }
    })

    await ready.start()

    expect(downloads).toHaveLength(0)
    expect(ready.getState()).toEqual({ status: 'ready' })
    expect(service.getState().status).toBe('missing')
  })

  it('hata durumunda error olur (yarım dosya korunur); start yeniden dener ve başarır', async () => {
    const { service, modelPath, downloads } = setup()

    const failing = service.start()
    writeFileSync(`${modelPath}.part`, Buffer.alloc(250)) // indirme 250 bayt yazıp koptu
    downloads[0].fail(new ModelDownloadError('network', 'bağlantı koptu'))
    await failing

    expect(service.getState()).toEqual({
      status: 'error',
      code: 'network',
      message: 'bağlantı koptu',
      partialBytes: 250
    })

    const retry = service.start()
    expect(downloads).toHaveLength(2)
    expect(service.getState().status).toBe('downloading')
    downloads[1].succeed()
    await retry
    expect(service.getState()).toEqual({ status: 'ready' })
  })

  it('beklenmeyen hata genel bir internal-error olarak bildirilir', async () => {
    const { service, downloads } = setup()

    const running = service.start()
    downloads[0].fail(new Error('ayrıntı: dosya yolu /gizli/yol'))
    await running

    expect(service.getState()).toMatchObject({ status: 'error', code: 'internal-error' })
    expect(JSON.stringify(service.getState())).not.toContain('/gizli/yol')
  })

  it('cancel indirmeyi iptal eder; hata değil missing olur ve yarım dosya korunur', async () => {
    const { service, modelPath, downloads } = setup()

    const running = service.start()
    writeFileSync(`${modelPath}.part`, Buffer.alloc(120))
    service.cancel()
    await running

    expect(downloads[0].signal?.aborted).toBe(true)
    expect(service.getState()).toEqual({ status: 'missing', partialBytes: 120 })
  })

  it('iptalden hemen sonra start çağrılırsa iptal edilen indirme bitince yenisi başlar', async () => {
    const { service, downloads } = setup()

    const first = service.start()
    service.cancel()
    const second = service.start() // iptal edilen indirme henüz tam çözülmedi

    await first
    expect(downloads).toHaveLength(2) // yeni indirme başladı
    expect(service.getState().status).toBe('downloading')

    downloads[1].succeed()
    await second
    expect(service.getState()).toEqual({ status: 'ready' })
  })
})

// Aynı yola yeni bir servis kurar (başlangıç durumunu yeniden okumak için).
function createFresh(modelPath: string): ModelService {
  return createModelService({
    modelPath,
    expectedSize: EXPECTED_SIZE,
    download: () => Promise.reject(new Error('kullanılmamalı'))
  })
}
