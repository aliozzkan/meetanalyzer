import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../../shared/meeting'
import {
  MICROPHONE_DEVICE_ID_MAX,
  MICROPHONE_LABEL_MAX,
  type MicrophoneSelection,
  type SettingsErrorCode
} from '../../shared/settings'
import type { Db } from '../db/database'

const DEFAULT_LANGUAGE_KEY = 'default_language'
const SYSTEM_AUDIO_CONSENT_KEY = 'system_audio_consent'
const MICROPHONE_DEVICE_ID_KEY = 'microphone_device_id'
const MICROPHONE_LABEL_KEY = 'microphone_label'

export class SettingsError extends Error {
  constructor(
    readonly code: SettingsErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'SettingsError'
  }
}

export interface SettingsServiceOptions {
  db: Db
}

export interface SettingsService {
  getDefaultLanguage: () => Language
  setDefaultLanguage: (language: Language) => void
  /** Sistem sesi kaydı bilgilendirmesi kabul edildi mi? Kabul edilmeden Recording başlamaz. */
  hasSystemAudioConsent: () => boolean
  acceptSystemAudioConsent: () => void
  /** Seçili mikrofon; `null` = sistem varsayılanı. */
  getMicrophone: () => MicrophoneSelection | null
  setMicrophone: (selection: MicrophoneSelection | null) => void
}

export function createSettingsService({ db }: SettingsServiceOptions): SettingsService {
  const select = db.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
  const remove = db.prepare<[string]>('DELETE FROM settings WHERE key = ?')
  const upsert = db.prepare<[string, string]>(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
  )

  return {
    getDefaultLanguage: () => {
      const stored = select.get(DEFAULT_LANGUAGE_KEY)?.value
      return LANGUAGES.find((language) => language === stored) ?? DEFAULT_LANGUAGE
    },
    setDefaultLanguage: (language) => {
      // IPC'den gelir: tipe güvenilmez.
      if (!LANGUAGES.includes(language)) {
        throw new SettingsError('invalid-input', `Desteklenmeyen dil: ${String(language)}`)
      }
      upsert.run(DEFAULT_LANGUAGE_KEY, language)
    },
    hasSystemAudioConsent: () => select.get(SYSTEM_AUDIO_CONSENT_KEY)?.value === 'accepted',
    acceptSystemAudioConsent: () => {
      upsert.run(SYSTEM_AUDIO_CONSENT_KEY, 'accepted')
    },
    getMicrophone: () => {
      const deviceId = select.get(MICROPHONE_DEVICE_ID_KEY)?.value
      if (!deviceId) return null
      return { deviceId, label: select.get(MICROPHONE_LABEL_KEY)?.value ?? '' }
    },
    setMicrophone: (selection) => {
      if (selection === null) {
        remove.run(MICROPHONE_DEVICE_ID_KEY)
        remove.run(MICROPHONE_LABEL_KEY)
        return
      }
      // IPC'den gelir: tipe güvenilmez.
      const { deviceId, label } = (selection ?? {}) as Partial<MicrophoneSelection>
      if (
        typeof deviceId !== 'string' ||
        deviceId.length === 0 ||
        deviceId.length > MICROPHONE_DEVICE_ID_MAX ||
        typeof label !== 'string' ||
        label.length > MICROPHONE_LABEL_MAX
      ) {
        throw new SettingsError('invalid-input', 'Geçersiz mikrofon seçimi')
      }
      upsert.run(MICROPHONE_DEVICE_ID_KEY, deviceId)
      upsert.run(MICROPHONE_LABEL_KEY, label)
    }
  }
}
