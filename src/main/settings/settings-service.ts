import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../../shared/meeting'
import type { SettingsErrorCode } from '../../shared/settings'
import type { Db } from '../db/database'

const DEFAULT_LANGUAGE_KEY = 'default_language'

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
}

export function createSettingsService({ db }: SettingsServiceOptions): SettingsService {
  const select = db.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
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
    }
  }
}
