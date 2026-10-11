import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SILENT_MIC_PEAK_THRESHOLD, SILENT_MIC_WARNING_MS } from '@shared/audio'
import { createSilenceMonitor } from '@shared/silence-monitor'
import { startMicCapture, type MicCapture } from './mic-capture'

export type RecorderState = 'idle' | 'starting' | 'recording' | 'stopping'

export interface Recorder {
  state: RecorderState
  /** 0..1, son ses bloğunun tepe seviyesi. */
  level: number
  /** Kaydın şu ana kadarki süresi (alınan sese göre). */
  elapsedMs: number
  /** Eşik süresi boyunca sessizlik: mikrofon sessize alınmış ya da yanlış seçilmiş olabilir. */
  silent: boolean
  /** Mikrofon izni verilmediği için kayıt başlamadı. */
  microphoneDenied: boolean
  start: () => Promise<void>
  stop: () => Promise<void>
}

interface ActiveCapture {
  recordingId: string
  capture: MicCapture
  /** Parçalar sırayla gönderilir; durdururken hepsinin işlenmesi beklenir. */
  appends: Promise<unknown>
  /** Durdurma başladı: yakalamanın son parçası hâlâ gönderilmeli, yeni durdurma istekleri yok sayılır. */
  finishing: boolean
  /** Ana süreç bir parçayı reddetti (kayıt artık sürmüyor); hata yalnızca bir kez bildirilir. */
  failed: boolean
}

function isPermissionError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError'
}

export function useRecorder(meetingId: string, onRecordingsChanged: () => void): Recorder {
  const [state, setState] = useState<RecorderState>('idle')
  const [level, setLevel] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [silent, setSilent] = useState(false)
  const [microphoneDenied, setMicrophoneDenied] = useState(false)
  const active = useRef<ActiveCapture | null>(null)
  const unmounted = useRef(false)

  // quiet: ekrandan çıkılırken ya da Meeting silinirken kullanıcıya hata gösterme.
  const finish = useCallback(
    async (quiet = false): Promise<void> => {
      const current = active.current
      if (!current || current.finishing) return
      current.finishing = true
      if (!unmounted.current) setState('stopping')
      try {
        // Oturum, son parça gönderilip tüm append'ler bitene kadar açık kalır: capture.stop() kalan sesi
        // son bir parça olarak onChunk'a verir.
        await current.capture.stop()
        await current.appends
      } finally {
        // Yakalama düzgün kapanmasa bile ana süreçteki Recording bitirilir; aksi halde takılı kalır.
        active.current = null
        const result = await window.api.recordings.stop(current.recordingId)
        // Ana süreç kaydı zaten reddettiyse (ör. Meeting silindi) kullanıcı bunu bir kez görmüştür.
        if (!result.ok && !current.failed && !quiet) toast.error(result.message)
        if (!unmounted.current) {
          setLevel(0)
          setSilent(false)
          setState('idle')
          onRecordingsChanged()
        }
      }
    },
    [onRecordingsChanged]
  )

  const start = useCallback(async (): Promise<void> => {
    setMicrophoneDenied(false)
    setState('starting')
    const started = await window.api.recordings.start(meetingId)
    if (!started.ok) {
      if (started.code === 'microphone-denied') setMicrophoneDenied(true)
      else toast.error(started.message)
      setState('idle')
      return
    }
    const recordingId = started.value.id

    const monitor = createSilenceMonitor({
      silenceMs: SILENT_MIC_WARNING_MS,
      peakThreshold: SILENT_MIC_PEAK_THRESHOLD
    })
    let elapsed = 0
    let capture: MicCapture
    try {
      capture = await startMicCapture({
        onChunk: (pcm) => {
          const current = active.current
          if (!current) return
          current.appends = current.appends.then(async () => {
            const result = await window.api.recordings.append(recordingId, pcm)
            // Kayıt artık yazılamıyor (Meeting silindi, disk hatası…): yakalamayı bırak ve kaydı bitir.
            if (!result.ok && !current.failed) {
              current.failed = true
              toast.error(result.message)
              void finish(true)
            }
          })
        },
        onLevel: (peak, durationMs) => {
          elapsed += durationMs
          setLevel(peak)
          setElapsedMs(elapsed)
          setSilent(monitor.feed(peak, durationMs))
        }
      })
    } catch (error) {
      // Mikrofon açılamadı (izin, cihaz yok, zaman aşımı): boş bir Recording bırakma.
      await window.api.recordings.discard(recordingId)
      if (isPermissionError(error)) setMicrophoneDenied(true)
      else
        toast.error(`Mikrofon açılamadı: ${error instanceof Error ? error.message : String(error)}`)
      setState('idle')
      return
    }

    // Mikrofon açılırken ekrandan çıkıldıysa hiçbir şey kaydedilmemiştir: boş bir Recording bırakmadan sil.
    if (unmounted.current) {
      await capture.stop()
      await window.api.recordings.discard(recordingId)
      return
    }
    active.current = {
      recordingId,
      capture,
      appends: Promise.resolve(),
      finishing: false,
      failed: false
    }
    setElapsedMs(0)
    setState('recording')
  }, [meetingId, finish])

  const stop = useCallback(() => finish(), [finish])

  // Ekran kapanırken (ör. listeye dönüş, Meeting silindi) süren kayıt düzgünce bitirilir.
  const finishRef = useRef(finish)
  useEffect(() => {
    finishRef.current = finish
  })
  useEffect(() => {
    unmounted.current = false
    return () => {
      unmounted.current = true
      void finishRef.current(true)
    }
  }, [])

  return { state, level, elapsedMs, silent, microphoneDenied, start, stop }
}
