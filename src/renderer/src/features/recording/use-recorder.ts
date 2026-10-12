import { useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { startMicCapture } from './mic-capture'
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

// Uygulama kabuğunda (yönlendirmenin üstünde) bir kez çağrılır: ekranlar arası gezinmek Recording'i durdurmaz.
// `onRecordingsChanged` kararlı olmalıdır (controller ilk render'daki değeri saklar).
export function useRecorder(onRecordingsChanged: () => void | Promise<void>): Recorder {
  const [controller] = useState<RecorderController>(() =>
    createRecorderController({
      recordings: window.api.recordings,
      startMicCapture,
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
