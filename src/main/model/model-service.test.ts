import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ModelState } from '../../shared/model'
import { ModelDownloadError } from './model-downloader'
import { createModelService, type ModelService, type ModelServiceOptions } from './model-service'

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

describe('Model silme', () => {
  it('hazır model silinir: dosya ve yarım indirme kalıntısı kalmaz, durum missing olur', () => {
    const { modelPath } = setup()
    writeFileSync(modelPath, Buffer.alloc(EXPECTED_SIZE))
    writeFileSync(`${modelPath}.part`, Buffer.alloc(10)) // önceki bir indirmeden kalmış
    const states: ModelState[] = []
    const service = createFresh(modelPath, { onState: (state) => states.push(state) })
    expect(service.getState()).toEqual({ status: 'ready' })

    service.remove()

    expect(existsSync(modelPath)).toBe(false)
    expect(existsSync(`${modelPath}.part`)).toBe(false)
    expect(service.getState()).toEqual({ status: 'missing', partialBytes: 0 })
    expect(states).toEqual([{ status: 'missing', partialBytes: 0 }])
  })

  it('olmayan model silinince hata vermez; yarım indirme kalıntısı da silinir', () => {
    const nothing = setup()
    nothing.service.remove()
    expect(nothing.service.getState()).toEqual({ status: 'missing', partialBytes: 0 })

    const partial = setup()
    writeFileSync(`${partial.modelPath}.part`, Buffer.alloc(300))
    const service = createFresh(partial.modelPath)
    expect(service.getState()).toEqual({ status: 'missing', partialBytes: 300 })

    service.remove()

    expect(existsSync(`${partial.modelPath}.part`)).toBe(false)
    expect(service.getState()).toEqual({ status: 'missing', partialBytes: 0 })
  })

  it('hata durumundaki modelin yarım dosyası silinir', async () => {
    const { service, modelPath, downloads } = setup()
    const failing = service.start()
    writeFileSync(`${modelPath}.part`, Buffer.alloc(250))
    downloads[0].fail(new ModelDownloadError('network', 'bağlantı koptu'))
    await failing
    expect(service.getState().status).toBe('error')

    service.remove()

    expect(existsSync(`${modelPath}.part`)).toBe(false)
    expect(service.getState()).toEqual({ status: 'missing', partialBytes: 0 })
  })

  it('indirme sürerken silme reddedilir; indirme ve yarım dosya etkilenmez', async () => {
    const { service, modelPath, downloads } = setup()
    const running = service.start()
    writeFileSync(`${modelPath}.part`, Buffer.alloc(400))

    expect(() => service.remove()).toThrow(
      expect.objectContaining({ name: 'ModelRemoveError', code: 'download-in-progress' })
    )
    expect(existsSync(`${modelPath}.part`)).toBe(true)
    expect(service.getState().status).toBe('downloading')

    downloads[0].succeed()
    await running
    expect(service.getState()).toEqual({ status: 'ready' })
  })

  it('iptal edilen indirme henüz çözülmemişken de silme reddedilir', async () => {
    const { service } = setup()
    const running = service.start()
    service.cancel()

    expect(() => service.remove()).toThrow(
      expect.objectContaining({ code: 'download-in-progress' })
    )
    await running
    service.remove()
    expect(service.getState()).toEqual({ status: 'missing', partialBytes: 0 })
  })

  it('silme yarıda kalırsa hata fırlar ve durum diskteki hâli yansıtır', () => {
    const { modelPath } = setup()
    writeFileSync(modelPath, Buffer.alloc(EXPECTED_SIZE))
    // Yarım indirme yolunda boş olmayan bir klasör: model dosyası silinir, ikinci silme başarısız olur.
    mkdirSync(`${modelPath}.part`)
    writeFileSync(join(`${modelPath}.part`, 'x'), 'x')
    const states: ModelState[] = []
    const service = createFresh(modelPath, { onState: (state) => states.push(state) })
    expect(service.getState()).toEqual({ status: 'ready' })

    expect(() => service.remove()).toThrow()

    expect(existsSync(modelPath)).toBe(false)
    expect(service.getState().status).toBe('missing')
    expect(states.map((state) => state.status)).toEqual(['missing'])
  })

  it('model kullanımdayken (Transcription Queue dolu) silme reddedilir; kuyruk boşalınca silinir', () => {
    const { modelPath } = setup()
    writeFileSync(modelPath, Buffer.alloc(EXPECTED_SIZE))
    let inUse = true
    const service = createFresh(modelPath, { isInUse: () => inUse })

    expect(() => service.remove()).toThrow(expect.objectContaining({ code: 'in-use' }))
    expect(existsSync(modelPath)).toBe(true)
    expect(service.getState()).toEqual({ status: 'ready' })

    inUse = false
    service.remove()
    expect(existsSync(modelPath)).toBe(false)
  })
})

describe('Modelin konumu', () => {
  it('model dosyası varsa dosyanın kendisi, yoksa bulunduğu klasör gösterilir', () => {
    const { service, modelPath } = setup()
    expect(service.location()).toEqual({ kind: 'folder', path: dirname(modelPath) })

    writeFileSync(modelPath, Buffer.alloc(EXPECTED_SIZE))
    expect(service.location()).toEqual({ kind: 'file', path: modelPath })
  })
})

// Aynı yola yeni bir servis kurar (başlangıç durumunu yeniden okumak için).
function createFresh(
  modelPath: string,
  options: Partial<Pick<ModelServiceOptions, 'onState' | 'isInUse'>> = {}
): ModelService {
  return createModelService({
    modelPath,
    expectedSize: EXPECTED_SIZE,
    download: () => Promise.reject(new Error('kullanılmamalı')),
    ...options
  })
}
