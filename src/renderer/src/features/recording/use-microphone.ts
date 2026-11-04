import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { MicrophoneSelection } from '@shared/settings'
import {
  buildMicrophoneChoices,
  listMicrophones,
  type MicrophoneChoice,
  type MicrophoneOption
} from './microphone-devices'

export interface MicrophoneApi {
  /** Kaydedilmiş seçim; `null` = sistem varsayılanı. */
  selection: MicrophoneSelection | null
  choices: MicrophoneChoice[]
  /** Cihaz adları okunabiliyor mu (mikrofon izni verilmiş mi)? */
  labelsAvailable: boolean
  /** Boş değer "Sistem varsayılanı"dır. */
  select: (deviceId: string) => Promise<void>
  /** Cihaz listesini yeniler (ör. seçici açılırken). */
  refresh: () => void
  /** Recording başlarken güncel seçimi okumak için; kararlı bir işlevdir. */
  getSelection: () => MicrophoneSelection | null
}

// Mikrofon seçimi ve bağlı cihaz listesi. Uygulama kabuğunda bir kez kurulur; Ayarlar ve Meeting ekranındaki
// hızlı seçici aynı durumu paylaşır.
export function useMicrophone(): MicrophoneApi {
  const [selection, setSelection] = useState<MicrophoneSelection | null>(null)
  const [options, setOptions] = useState<MicrophoneOption[]>([])
  const [labelsAvailable, setLabelsAvailable] = useState(false)
  const selectionRef = useRef<MicrophoneSelection | null>(null)
  const optionsRef = useRef<MicrophoneOption[]>([])

  const apply = useCallback((next: MicrophoneSelection | null) => {
    selectionRef.current = next
    setSelection(next)
  }, [])

  const refresh = useCallback(() => {
    const devices = navigator.mediaDevices
    if (!devices?.enumerateDevices) return
    void devices
      .enumerateDevices()
      .then((list) => {
        const listed = listMicrophones(list)
        optionsRef.current = listed.options
        setOptions(listed.options)
        setLabelsAvailable(listed.labelsAvailable)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.api.settings.getMicrophone().then((result) => {
      if (!cancelled && result.ok) apply(result.value)
    })
    refresh()
    const devices = navigator.mediaDevices
    devices?.addEventListener('devicechange', refresh)
    // Etiketler mikrofon izni verildikten sonra görünür; kullanıcı izin verip uygulamaya dönünce liste dolsun.
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      devices?.removeEventListener('devicechange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [apply, refresh])

  const select = useCallback(
    async (deviceId: string): Promise<void> => {
      let next: MicrophoneSelection | null = null
      if (deviceId !== '') {
        const label =
          optionsRef.current.find((option) => option.deviceId === deviceId)?.label ??
          (selectionRef.current?.deviceId === deviceId ? selectionRef.current.label : '')
        next = { deviceId, label }
      }
      const result = await window.api.settings.setMicrophone(next)
      if (result.ok) apply(next)
      else toast.error(result.message)
    },
    [apply]
  )

  const getSelection = useCallback(() => selectionRef.current, [])
  const choices = useMemo(
    () => buildMicrophoneChoices(options, labelsAvailable, selection),
    [options, labelsAvailable, selection]
  )

  return { selection, choices, labelsAvailable, select, refresh, getSelection }
}
