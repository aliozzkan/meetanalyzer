import { join } from 'node:path'
import { WHISPER_VAD_MODEL_FILE } from '../config'

export interface ResourceEnv {
  isPackaged: boolean
  appPath: string
  resourcesPath: string
}

export interface WhisperPaths {
  cli: string
  vadModel: string
}

// scripts/build-whisper.sh bu dosyaları resources/ altına koyar.
const CLI_RELATIVE = ['bin', 'whisper-cli']
const VAD_MODEL_RELATIVE = ['models', WHISPER_VAD_MODEL_FILE]

export function getWhisperPaths(env: ResourceEnv): WhisperPaths {
  const resourcesDir = env.isPackaged
    ? join(env.resourcesPath, 'app.asar.unpacked', 'resources')
    : join(env.appPath, 'resources')
  return {
    cli: join(resourcesDir, ...CLI_RELATIVE),
    vadModel: join(resourcesDir, ...VAD_MODEL_RELATIVE)
  }
}
