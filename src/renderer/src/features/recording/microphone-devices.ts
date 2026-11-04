import type { MicrophoneSelection } from '@shared/settings'

export interface MicrophoneOption {
  deviceId: string
  label: string
}

export interface MicrophoneChoice {
  /** Seçeneğin değeri; boş = "Sistem varsayılanı". */
  value: string
  label: string
}

export const SYSTEM_DEFAULT_LABEL = 'Sistem varsayılanı'

// Windows'ta `enumerateDevices` ayrıca "default" ve "communications" sanal girişlerini döndürür; bunlar
// "Sistem varsayılanı" seçeneğiyle aynı şeydir ve cihaz olarak listelenmez.
const VIRTUAL_DEVICE_IDS = new Set(['default', 'communications'])

/** Bağlı ses giriş cihazları. Etiketler mikrofon izni verilmeden boş gelir; o durumda liste de boştur. */
export function listMicrophones(devices: readonly MediaDeviceInfo[]): {
  options: MicrophoneOption[]
  labelsAvailable: boolean
} {
  const inputs = devices.filter(
    (device) =>
      device.kind === 'audioinput' && device.deviceId && !VIRTUAL_DEVICE_IDS.has(device.deviceId)
  )
  const labelsAvailable = inputs.some((device) => device.label !== '')
  if (!labelsAvailable) return { options: [], labelsAvailable: false }
  const seen = new Set<string>()
  const options: MicrophoneOption[] = []
  for (const device of inputs) {
    if (seen.has(device.deviceId)) continue
    seen.add(device.deviceId)
    options.push({ deviceId: device.deviceId, label: device.label || device.deviceId })
  }
  return { options, labelsAvailable: true }
}

/**
 * Seçicinin seçenekleri: "Sistem varsayılanı", bağlı cihazlar ve (bağlı değilse) kaydedilmiş cihaz.
 * Etiketler okunamıyorsa (izin yok) cihazın bağlı olup olmadığı bilinmez; kaydedilmiş cihaz olduğu gibi gösterilir.
 */
export function buildMicrophoneChoices(
  options: readonly MicrophoneOption[],
  labelsAvailable: boolean,
  selection: MicrophoneSelection | null
): MicrophoneChoice[] {
  const choices: MicrophoneChoice[] = [{ value: '', label: SYSTEM_DEFAULT_LABEL }]
  for (const option of options) choices.push({ value: option.deviceId, label: option.label })
  if (selection && !options.some((option) => option.deviceId === selection.deviceId)) {
    const name = selection.label || 'Seçili mikrofon'
    choices.push({
      value: selection.deviceId,
      label: labelsAvailable ? `${name} (bağlı değil)` : name
    })
  }
  return choices
}
