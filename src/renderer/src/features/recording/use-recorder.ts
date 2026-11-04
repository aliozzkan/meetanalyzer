import { useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { MicrophoneSelection } from '@shared/settings'
import { createMacLoopbackSource } from './mac-loopback-source'
import { createMicSource, type MicFallback } from './mic-source'
import {
  createRecorderController,
  type RecorderController,
  type RecorderSnapshot
} from './recorder-controller'

export interface Recorder extends RecorderSnapshot {
  start: (meetingId: string) => Promise<void>
  stop: () => Promise<void>
  /** Meeting silinirken ya da uygulama kapanırken: Recording bitirilir, hata gösterilmez. */
  stopQuietly: () => Promise<void>
}

function fallbackMessage(event: MicFallback): string {
  return event.reason === 'not-found'
    ? `${event.label || 'Seçili mikrofon'} bulunamadı, sistem varsayılanı mikrofon kullanıldı.`
    : 'Mikrofon kesildi, varsayılan mikrofona geçildi.'
}

// Uygulama kabuğunda (yönlendirmenin üstünde) bir kez çağrılır: ekranlar arası gezinmek Recording'i durdurmaz.
// `onRecordingsChanged` ve `getMicrophone` kararlı olmalıdır (controller ilk render'daki değerleri saklar).
export function useRecorder(
  onRecordingsChanged: () => void | Promise<void>,
  getMicrophone: () => MicrophoneSelection | null
): Recorder {
  const [controller] = useState<RecorderController>(() =>
    createRecorderController({
      recordings: window.api.recordings,
      createSources: () => ({
        mic: createMicSource({
          selection: getMicrophone(),
          onFallback: (event) => toast.info(fallbackMessage(event))
        }),
        system: createMacLoopbackSource()
      }),
      notifyError: (message) => toast.error(message),
      onRecordingsChanged: () => void onRecordingsChanged()
    })
  )
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  // Kabuk söküldüğünde süren kayıt bitirilmeye çalışılır. Asıl güvence main'dedir: sayfa yenileme, renderer çökmesi
  // ve pencere kapanışında `recordings.stopAll()` çalışır (src/main/index.ts).
  useEffect(() => () => void controller.stopQuietly(), [controller])

  return {
    ...snapshot,
    start: controller.start,
    stop: controller.stop,
    stopQuietly: controller.stopQuietly
  }
}
