import { mkdirSync, statfsSync } from 'node:fs'
import { join } from 'node:path'
import type { ModelState } from '../../shared/model'
import {
  MODEL_DOWNLOAD_MIN_FREE_BYTES,
  TRANSCRIPTION_MODEL,
  TRANSCRIPTION_MODEL_URL
} from '../config'
import { downloadModel } from './model-downloader'
import { createModelService, type ModelService } from './model-service'

// Transcription modelinin kurulu yolu; issue 08'deki whisper çalıştırıcı bunu kullanır.
export function getModelPath(modelsDir: string): string {
  return join(modelsDir, TRANSCRIPTION_MODEL.fileName)
}

// Üretim bağlantısı: config'teki sabit URL, hash ve boyutla indiren servis.
export function createAppModelService({
  modelsDir,
  onState,
  isInUse
}: {
  modelsDir: string
  onState: (state: ModelState) => void
  isInUse: () => boolean
}): ModelService {
  mkdirSync(modelsDir, { recursive: true })
  const modelPath = getModelPath(modelsDir)
  return createModelService({
    modelPath,
    expectedSize: TRANSCRIPTION_MODEL.sizeBytes,
    onState,
    isInUse,
    download: ({ onProgress, signal }) =>
      downloadModel({
        url: TRANSCRIPTION_MODEL_URL,
        destPath: modelPath,
        expectedSha256: TRANSCRIPTION_MODEL.sha256,
        expectedSize: TRANSCRIPTION_MODEL.sizeBytes,
        minFreeBytes: MODEL_DOWNLOAD_MIN_FREE_BYTES,
        freeBytes: () => {
          const stats = statfsSync(modelsDir)
          return stats.bavail * stats.bsize
        },
        onProgress,
        signal
      })
  })
}
