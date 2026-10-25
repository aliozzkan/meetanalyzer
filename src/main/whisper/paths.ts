import { posix, win32 } from 'node:path'
import { WHISPER_VAD_MODEL_FILE } from '../config'
import { TranscriptionError } from '../transcription/errors'

export interface ResourceEnv {
  isPackaged: boolean
  appPath: string
  resourcesPath: string
  platform: NodeJS.Platform
  arch: NodeJS.Architecture
}

export interface WhisperPaths {
  cli: string
  vadModel: string
}

// whisper-cli derlenmiş olan platformlar; scripts/build-whisper.mjs bunları resources/bin/<platform>-<arch>/
// altına koyar. Paketli uygulamada electron-builder yalnızca o platformun klasörünü `bin/` olarak katar
// (electron-builder.yml → extraResources).
const CLI_FILE: Record<string, string> = {
  'darwin-arm64': 'whisper-cli',
  'win32-x64': 'whisper-cli.exe'
}
const VAD_MODEL_RELATIVE = ['models', WHISPER_VAD_MODEL_FILE]

export function getWhisperPaths(env: ResourceEnv): WhisperPaths {
  const target = `${env.platform}-${env.arch}`
  const cliFile = CLI_FILE[target]
  if (!cliFile) {
    throw new TranscriptionError(
      'whisper-missing',
      `whisper-cli bu platform için derlenmiyor (${target}).`
    )
  }

  const { join } = env.platform === 'win32' ? win32 : posix
  const unpackedResources = env.isPackaged
    ? join(env.resourcesPath, 'app.asar.unpacked', 'resources')
    : join(env.appPath, 'resources')
  return {
    cli: env.isPackaged
      ? join(env.resourcesPath, 'bin', cliFile)
      : join(env.appPath, 'resources', 'bin', target, cliFile),
    vadModel: join(unpackedResources, ...VAD_MODEL_RELATIVE)
  }
}
