import { describe, expect, it } from 'vitest'
import { buildMicrophoneChoices, listMicrophones } from './microphone-devices'

function device(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: '', toJSON: () => ({}) }
}

describe('listMicrophones', () => {
  it('yalnızca ses giriş cihazlarını listeler; sanal "default" ve "communications" girişlerini atar', () => {
    const { options, labelsAvailable } = listMicrophones([
      device('audioinput', 'default', 'Default - Dahili Mikrofon'),
      device('audioinput', 'communications', 'Communications - Dahili Mikrofon'),
      device('audioinput', 'a', 'Dahili Mikrofon'),
      device('audioinput', 'b', 'USB Mic'),
      device('audiooutput', 'c', 'Hoparlör'),
      device('videoinput', 'd', 'Kamera')
    ])

    expect(labelsAvailable).toBe(true)
    expect(options).toEqual([
      { deviceId: 'a', label: 'Dahili Mikrofon' },
      { deviceId: 'b', label: 'USB Mic' }
    ])
  })

  it('izin verilmediyse (etiketler boş) liste boştur ve etiket yok bilgisi verilir', () => {
    expect(listMicrophones([device('audioinput', 'a', ''), device('audioinput', 'b', '')])).toEqual(
      {
        options: [],
        labelsAvailable: false
      }
    )
  })

  it('aynı cihaz kimliğini bir kez listeler', () => {
    const { options } = listMicrophones([
      device('audioinput', 'a', 'Mic'),
      device('audioinput', 'a', 'Mic')
    ])

    expect(options).toHaveLength(1)
  })
})

describe('buildMicrophoneChoices', () => {
  const usb = { deviceId: 'b', label: 'USB Mic' }

  it('seçim yokken yalnızca "Sistem varsayılanı" ve bağlı cihazları gösterir', () => {
    expect(buildMicrophoneChoices([usb], true, null)).toEqual([
      { value: '', label: 'Sistem varsayılanı' },
      { value: 'b', label: 'USB Mic' }
    ])
  })

  it('kaydedilmiş cihaz bağlı değilse "(bağlı değil)" olarak ekler', () => {
    expect(buildMicrophoneChoices([], true, usb)).toEqual([
      { value: '', label: 'Sistem varsayılanı' },
      { value: 'b', label: 'USB Mic (bağlı değil)' }
    ])
  })

  it('kaydedilmiş cihaz bağlıysa yinelemez', () => {
    expect(buildMicrophoneChoices([usb], true, usb)).toHaveLength(2)
  })

  it('etiketler okunamıyorsa kaydedilmiş cihazın bağlı olduğu varsayılmaz ama "bağlı değil" de denmez', () => {
    expect(buildMicrophoneChoices([], false, usb)).toEqual([
      { value: '', label: 'Sistem varsayılanı' },
      { value: 'b', label: 'USB Mic' }
    ])
  })
})
