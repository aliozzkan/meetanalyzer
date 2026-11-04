import { describe, expect, it } from 'vitest'
import { getWhisperPaths } from './paths'

describe('getWhisperPaths', () => {
  it('geliştirmede (macOS) proje klasöründeki platform alt klasörünü gösterir', () => {
    const paths = getWhisperPaths({
      isPackaged: false,
      appPath: '/dev/meeting-app',
      resourcesPath: '/ignored',
      platform: 'darwin',
      arch: 'arm64'
    })

    expect(paths).toEqual({
      cli: '/dev/meeting-app/resources/bin/darwin-arm64/whisper-cli',
      vadModel: '/dev/meeting-app/resources/models/ggml-silero-v6.2.0.bin'
    })
  })

  it('paketli macOS uygulamasında binary Resources/bin altında, VAD modeli asar dışındadır', () => {
    const paths = getWhisperPaths({
      isPackaged: true,
      appPath: '/Applications/Meetanalyzing.app/Contents/Resources/app.asar',
      resourcesPath: '/Applications/Meetanalyzing.app/Contents/Resources',
      platform: 'darwin',
      arch: 'arm64'
    })

    expect(paths).toEqual({
      cli: '/Applications/Meetanalyzing.app/Contents/Resources/bin/whisper-cli',
      vadModel:
        '/Applications/Meetanalyzing.app/Contents/Resources/app.asar.unpacked/resources/models/ggml-silero-v6.2.0.bin'
    })
  })

  it('geliştirmede (Windows) .exe uzantılı binary’yi ve Windows yol ayracını kullanır', () => {
    const paths = getWhisperPaths({
      isPackaged: false,
      appPath: 'C:\\dev\\meeting-app',
      resourcesPath: 'C:\\ignored',
      platform: 'win32',
      arch: 'x64'
    })

    expect(paths).toEqual({
      cli: 'C:\\dev\\meeting-app\\resources\\bin\\win32-x64\\whisper-cli.exe',
      vadModel: 'C:\\dev\\meeting-app\\resources\\models\\ggml-silero-v6.2.0.bin'
    })
  })

  it('paketli Windows uygulamasında binary resources\\bin altındadır', () => {
    const resourcesPath = 'C:\\Users\\Seçkin\\AppData\\Local\\Programs\\Meetanalyzing\\resources'
    const paths = getWhisperPaths({
      isPackaged: true,
      appPath: `${resourcesPath}\\app.asar`,
      resourcesPath,
      platform: 'win32',
      arch: 'x64'
    })

    expect(paths).toEqual({
      cli: `${resourcesPath}\\bin\\whisper-cli.exe`,
      vadModel: `${resourcesPath}\\app.asar.unpacked\\resources\\models\\ggml-silero-v6.2.0.bin`
    })
  })

  it('whisper-cli derlenmeyen platformda whisper-missing hatası verir', () => {
    expect(() =>
      getWhisperPaths({
        isPackaged: false,
        appPath: '/dev/meeting-app',
        resourcesPath: '/ignored',
        platform: 'linux',
        arch: 'x64'
      })
    ).toThrow(
      expect.objectContaining({
        code: 'whisper-missing',
        message: expect.stringContaining('linux-x64')
      })
    )
  })
})
