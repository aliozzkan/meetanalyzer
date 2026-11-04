import { useEffect } from 'react'
import { NativeSelect, NativeSelectOption } from '@renderer/components/ui/native-select'
import type { MicrophoneApi } from './use-microphone'

interface Props {
  microphone: MicrophoneApi
  id?: string
  disabled?: boolean
  size?: 'sm' | 'default'
  className?: string
}

// Ayarlar'daki ve Meeting ekranındaki mikrofon seçicisi; ikisi aynı seçimi okur ve yazar.
export function MicrophoneSelect({
  microphone,
  id,
  disabled,
  size,
  className
}: Props): React.JSX.Element {
  const { refresh } = microphone
  // Açılırken liste tazelenir: cihaz takılmış ya da izin yeni verilmiş olabilir.
  useEffect(() => refresh(), [refresh])

  return (
    <NativeSelect
      id={id}
      aria-label="Mikrofon"
      size={size}
      className={className}
      disabled={disabled}
      value={microphone.selection?.deviceId ?? ''}
      onChange={(event) => void microphone.select(event.target.value)}
    >
      {microphone.choices.map((choice) => (
        <NativeSelectOption key={choice.value} value={choice.value}>
          {choice.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
