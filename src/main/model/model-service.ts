import { existsSync, statSync } from 'node:fs'
import type { ModelState } from '../../shared/model'
import { ModelDownloadError, type DownloadProgress } from './model-downloader'

export interface ModelServiceOptions {
  /** Kurulu modelin son yolu; yarım indirme `<modelPath>.part` dosyasındadır. */
  modelPath: string
  expectedSize: number
  /** İndirmeyi çalıştırır (üretimde `downloadModel`). */
  download: (options: {
    onProgress: (progress: DownloadProgress) => void
    signal: AbortSignal
  }) => Promise<void>
  onState?: (state: ModelState) => void
}

export interface ModelService {
  getState: () => ModelState
  /** İndirmeyi başlatır (ya da sürmekte olana katılır); asla reddetmez, sonuç duruma yansır. */
  start: () => Promise<void>
  /** Sürmekte olan indirmeyi durdurur; yarım dosya korunur. */
  cancel: () => void
}

// Modelin kurulu olup olmadığı ve indirme durumu. İndirme yalnızca `start` ile, kullanıcı isteğiyle başlar.
export function createModelService({
  modelPath,
  expectedSize,
  download,
  onState
}: ModelServiceOptions): ModelService {
  const partPath = `${modelPath}.part`
  let state: ModelState = stateOnDisk()
  let running: Promise<void> | undefined
  let controller: AbortController | undefined
  let cancelRequested = false

  // Kurulu sayılma ölçütü: beklenen boyutta dosya. Dosya yalnızca hash doğrulandıktan sonra yerine
  // alındığı için (bkz. model-downloader) boyut yeterlidir; her açılışta yeniden hash hesaplanmaz.
  function stateOnDisk(): ModelState {
    if (existsSync(modelPath) && statSync(modelPath).size === expectedSize) {
      return { status: 'ready' }
    }
    return { status: 'missing', partialBytes: partialBytes() }
  }

  function partialBytes(): number {
    return existsSync(partPath) ? statSync(partPath).size : 0
  }

  function setState(next: ModelState): void {
    state = next
    onState?.(state)
  }

  async function run(): Promise<void> {
    controller = new AbortController()
    setState({ status: 'downloading', receivedBytes: partialBytes(), totalBytes: expectedSize })
    try {
      await download({
        signal: controller.signal,
        onProgress: ({ receivedBytes, totalBytes }) =>
          setState({ status: 'downloading', receivedBytes, totalBytes })
      })
      setState({ status: 'ready' })
    } catch (error) {
      if (controller.signal.aborted) {
        setState({ status: 'missing', partialBytes: partialBytes() })
      } else if (error instanceof ModelDownloadError) {
        setState({
          status: 'error',
          code: error.code,
          message: error.message,
          partialBytes: partialBytes()
        })
      } else {
        // Ayrıntı (dosya yolları vb.) kullanıcıya gösterilmez; loglanır.
        console.error('Model indirme beklenmeyen hata verdi:', error)
        setState({
          status: 'error',
          code: 'internal-error',
          message: 'Beklenmeyen bir hata oluştu.',
          partialBytes: partialBytes()
        })
      }
    } finally {
      running = undefined
      controller = undefined
      cancelRequested = false
    }
  }

  function start(): Promise<void> {
    if (state.status === 'ready') return Promise.resolve()
    if (running) {
      // İptal edilen indirme tam çözülmeden yenisi başlatılamaz (aynı .part'a iki yazıcı olmasın);
      // iptal bitince yeniden başlatılır.
      return cancelRequested ? running.then(() => start()) : running
    }
    running = run()
    return running
  }

  function cancel(): void {
    if (!controller) return
    cancelRequested = true
    controller.abort()
  }

  return { getState: () => state, start, cancel }
}
