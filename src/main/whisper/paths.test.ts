import { describe, expect, it } from 'vitest'
import { getWhisperPaths } from './paths'

describe('getWhisperPaths', () => {
  it('geliştirmede proje klasöründeki resources altını gösterir', () => {
    const paths = getWhisperPaths({
      isPackaged: false,
      appPath: '/dev/meeting-app',
      resourcesPath: '/ignored'
    })

    expect(paths).toEqual({
      cli: '/dev/meeting-app/resources/bin/whisper-cli',
      vadModel: '/dev/meeting-app/resources/models/ggml-silero-v6.2.0.bin'
    })
  })

  it('paketli uygulamada asar dışına açılmış resources altını gösterir', () => {
    const paths = getWhisperPaths({
      isPackaged: true,
      appPath: '/Applications/Meetanalyzing.app/Contents/Resources/app.asar',
      resourcesPath: '/Applications/Meetanalyzing.app/Contents/Resources'
    })

    expect(paths).toEqual({
      cli: '/Applications/Meetanalyzing.app/Contents/Resources/app.asar.unpacked/resources/bin/whisper-cli',
      vadModel:
        '/Applications/Meetanalyzing.app/Contents/Resources/app.asar.unpacked/resources/models/ggml-silero-v6.2.0.bin'
    })
  })
})
