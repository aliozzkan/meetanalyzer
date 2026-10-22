import { existsSync, rmSync, statSync } from 'node:fs'
import {
  MODEL_REMOVE_BLOCKED,
  type ModelRemoveErrorCode,
  type ModelState
} from '../../shared/model'
import { ModelDownloadError, type DownloadProgress } from './model-downloader'

export class ModelError extends Error {
  constructor(
    readonly code: ModelRemoveErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ModelError'
  }
}

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
  /** Model kullanımda mı (Transcription Queue'da işlenen ya da bekleyen Meeting var); öyleyse silinemez. */
  isInUse?: () => boolean
}

export interface ModelService {
  getState: () => ModelState
  /** İndirmeyi başlatır (ya da sürmekte olana katılır); asla reddetmez, sonuç duruma yansır. */
  start: () => Promise<void>
  /** Sürmekte olan indirmeyi durdurur; yarım dosya korunur. */
  cancel: () => void
  /** Model dosyasını ve yarım indirmeyi siler; durum `missing` olur. İndirme sürerken ya da model
   * kullanımdayken `ModelError` fırlatır. */
  remove: () => void
}

// Modelin kurulu olup olmadığı ve indirme durumu. İndirme yalnızca `start` ile, kullanıcı isteğiyle başlar.
export function createModelService({
  modelPath,
  expectedSize,
  download,
  onState,
  isInUse = () => false
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

  function remove(): void {
    // İptal edilen indirme de tam çözülene kadar sürüyor sayılır: .part'a hâlâ yazıyor olabilir.
    if (running) {
      throw new ModelError('download-in-progress', MODEL_REMOVE_BLOCKED['download-in-progress'])
    }
    // Çalışan whisper modeli okuyor; bekleyen Meeting'ler de onu kullanacak.
    if (isInUse()) {
      throw new ModelError('in-use', MODEL_REMOVE_BLOCKED['in-use'])
    }
    rmSync(modelPath, { force: true })
    rmSync(partPath, { force: true })
    setState({ status: 'missing', partialBytes: 0 })
  }

  return { getState: () => state, start, cancel, remove }
}
