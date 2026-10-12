import { describe, expect, it, vi } from 'vitest'
import { SILENT_MIC_PEAK_THRESHOLD, SILENT_MIC_WARNING_MS } from '@shared/audio'
import type { RecordingSummary } from '@shared/recording'
import type { MicCapture, MicCaptureHandlers } from './mic-capture'
import { createRecorderController, type RecorderDeps } from './recorder-controller'

type Recordings = RecorderDeps['recordings']

function summary(id: string, meetingId: string): RecordingSummary {
  return { id, meetingId, seq: 1, startedAt: 0, endedAt: null, durationMs: null }
}

// Sınırdaki bağımlılıklar (ana süreç IPC'si ve mikrofon) sahtedir; controller'ın kendisi gerçektir.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- tip, donanımın kendisinden çıkarılır
function createHarness() {
  const handlers: { current?: MicCaptureHandlers } = {}
  const calls: string[] = []
  const recordings = {
    start: vi.fn<Recordings['start']>(async (meetingId) => {
      calls.push('recordings.start')
      return { ok: true, value: summary('rec-1', meetingId) }
    }),
    append: vi.fn<Recordings['append']>(async () => {
      calls.push('recordings.append')
      return { ok: true, value: undefined }
    }),
    stop: vi.fn<Recordings['stop']>(async (recordingId) => {
      calls.push('recordings.stop')
      return { ok: true, value: summary(recordingId, 'm-1') }
    }),
    discard: vi.fn<Recordings['discard']>(async () => {
      calls.push('recordings.discard')
      return { ok: true, value: undefined }
    })
  }
  const capture: MicCapture = {
    stop: vi.fn(async () => {
      calls.push('capture.stop')
    })
  }
  const startMicCapture = vi.fn(async (h: MicCaptureHandlers): Promise<MicCapture> => {
    handlers.current = h
    return capture
  })
  const notifyError = vi.fn()
  const onRecordingsChanged = vi.fn()
  const controller = createRecorderController({
    recordings,
    startMicCapture,
    notifyError,
    onRecordingsChanged
  })
  return {
    controller,
    recordings,
    capture,
    startMicCapture,
    notifyError,
    onRecordingsChanged,
    calls,
    handlers
  }
}

describe('createRecorderController', () => {
  it('start: Meeting için Recording açar, mikrofonu başlatır ve kayıtta olduğunu bildirir', async () => {
    const { controller, recordings } = createHarness()

    await controller.start('m-1')

    expect(recordings.start).toHaveBeenCalledWith('m-1')
    expect(controller.getSnapshot()).toMatchObject({
      state: 'recording',
      meetingId: 'm-1',
      microphoneDeniedFor: null
    })
  })

  it("mikrofondan gelen parçalar Recording'e sırayla eklenir", async () => {
    const { controller, recordings, handlers } = createHarness()
    await controller.start('m-1')
    const first = new Uint8Array([1])
    const second = new Uint8Array([2])

    handlers.current?.onChunk(first)
    handlers.current?.onChunk(second)
    await controller.stop()

    expect(recordings.append.mock.calls).toEqual([
      ['rec-1', first],
      ['rec-1', second]
    ])
  })

  it('durdururken son parça ve bekleyen eklemeler bitmeden Recording bitirilmez', async () => {
    const { controller, recordings, capture, calls, handlers, onRecordingsChanged } =
      createHarness()
    let releaseAppend: () => void = () => {}
    recordings.append.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => (releaseAppend = resolve))
      calls.push('append.done')
      return { ok: true, value: undefined }
    })
    await controller.start('m-1')
    handlers.current?.onChunk(new Uint8Array([1]))
    // capture.stop() kalan sesi son bir parça olarak bırakır.
    vi.mocked(capture.stop).mockImplementationOnce(async () => {
      handlers.current?.onChunk(new Uint8Array([2]))
      calls.push('capture.stop')
    })

    const stopping = controller.stop()
    await Promise.resolve()
    expect(controller.getSnapshot().state).toBe('stopping')
    expect(recordings.stop).not.toHaveBeenCalled()

    releaseAppend()
    await stopping

    expect(calls.filter((c) => c !== 'recordings.start')).toEqual([
      'capture.stop',
      'append.done',
      'recordings.append',
      'recordings.stop'
    ])
    expect(controller.getSnapshot()).toMatchObject({ state: 'idle', meetingId: null })
    expect(onRecordingsChanged).toHaveBeenCalledTimes(1)
  })

  it('stop art arda çağrılsa da Recording yalnızca bir kez bitirilir', async () => {
    const { controller, recordings, capture } = createHarness()
    await controller.start('m-1')

    await Promise.all([controller.stop(), controller.stop()])

    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(recordings.stop).toHaveBeenCalledTimes(1)
  })

  it('Recording sürerken ya da başlarken yapılan ikinci start yok sayılır', async () => {
    const { controller, recordings } = createHarness()

    await Promise.all([controller.start('m-1'), controller.start('m-2')])
    await controller.start('m-3')

    expect(recordings.start).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().meetingId).toBe('m-1')
  })

  it('ana süreç mikrofon iznini reddederse mikrofon izni uyarısı işaretlenir, hata bildirilmez', async () => {
    const { controller, recordings, notifyError, startMicCapture } = createHarness()
    recordings.start.mockResolvedValueOnce({
      ok: false,
      code: 'microphone-denied',
      message: 'izin yok'
    })

    await controller.start('m-1')

    // İzin uyarısı, kaydı denenen Meeting'in ekranında gösterilir; Recording yoksa meetingId boştur.
    expect(controller.getSnapshot()).toMatchObject({
      state: 'idle',
      meetingId: null,
      microphoneDeniedFor: 'm-1'
    })
    expect(notifyError).not.toHaveBeenCalled()
    expect(startMicCapture).not.toHaveBeenCalled()
  })

  it("ana süreç başka bir nedenle reddederse hata bir kez bildirilir ve idle'a dönülür", async () => {
    const { controller, recordings, notifyError } = createHarness()
    recordings.start.mockResolvedValueOnce({
      ok: false,
      code: 'meeting-not-recording',
      message: 'Meeting kayıtta değil'
    })

    await controller.start('m-1')

    expect(notifyError).toHaveBeenCalledExactlyOnceWith('Meeting kayıtta değil')
    expect(controller.getSnapshot()).toMatchObject({ state: 'idle', microphoneDeniedFor: null })
  })

  it('mikrofon izni verilmezse boş Recording silinir ve izin uyarısı işaretlenir', async () => {
    const { controller, recordings, startMicCapture, notifyError } = createHarness()
    startMicCapture.mockRejectedValueOnce(new DOMException('izin yok', 'NotAllowedError'))

    await controller.start('m-1')

    expect(recordings.discard).toHaveBeenCalledWith('rec-1')
    expect(notifyError).not.toHaveBeenCalled()
    // İzin uyarısı, kaydı denenen Meeting'in ekranında gösterilir; Recording yoksa meetingId boştur.
    expect(controller.getSnapshot()).toMatchObject({
      state: 'idle',
      meetingId: null,
      microphoneDeniedFor: 'm-1'
    })
  })

  it('mikrofon başka bir nedenle açılamazsa boş Recording silinir ve hata bildirilir', async () => {
    const { controller, recordings, startMicCapture, notifyError } = createHarness()
    startMicCapture.mockRejectedValueOnce(new Error('cihaz yok'))

    await controller.start('m-1')

    expect(recordings.discard).toHaveBeenCalledWith('rec-1')
    expect(notifyError).toHaveBeenCalledExactlyOnceWith('Mikrofon açılamadı: cihaz yok')
    expect(controller.getSnapshot()).toMatchObject({ state: 'idle', microphoneDeniedFor: null })
  })

  it('ana süreç bir parçayı reddederse hata bir kez bildirilir ve Recording sessizce biter', async () => {
    const { controller, recordings, notifyError, handlers } = createHarness()
    recordings.append.mockResolvedValueOnce({
      ok: false,
      code: 'unknown-recording',
      message: 'Recording yok'
    })
    recordings.stop.mockResolvedValueOnce({
      ok: false,
      code: 'unknown-recording',
      message: 'Recording yok'
    })
    await controller.start('m-1')

    handlers.current?.onChunk(new Uint8Array([1]))
    handlers.current?.onChunk(new Uint8Array([2]))
    await vi.waitFor(() => expect(controller.getSnapshot().state).toBe('idle'))

    expect(notifyError).toHaveBeenCalledExactlyOnceWith('Recording yok')
    expect(recordings.stop).toHaveBeenCalledTimes(1)
    expect(recordings.append).toHaveBeenCalledTimes(1)
  })

  it('kullanıcı durdururken Recording bitirilemezse hata bildirilir', async () => {
    const { controller, recordings, notifyError } = createHarness()
    recordings.stop.mockResolvedValueOnce({
      ok: false,
      code: 'internal-error',
      message: 'disk dolu'
    })
    await controller.start('m-1')

    await controller.stop()

    expect(notifyError).toHaveBeenCalledExactlyOnceWith('disk dolu')
    expect(controller.getSnapshot().state).toBe('idle')
  })

  it("stopQuietly Recording'i bitirir ve bitirme hatasını bildirmez", async () => {
    const { controller, recordings, notifyError } = createHarness()
    recordings.stop.mockResolvedValueOnce({ ok: false, code: 'unknown-recording', message: 'yok' })
    await controller.start('m-1')

    await controller.stopQuietly()

    expect(recordings.stop).toHaveBeenCalledTimes(1)
    expect(notifyError).not.toHaveBeenCalled()
    expect(controller.getSnapshot().state).toBe('idle')
  })

  it('mikrofon açılırken stopQuietly gelirse açılan yakalama kapatılır, boş Recording silinir', async () => {
    const { controller, recordings, capture, startMicCapture } = createHarness()
    let openMic: (capture: MicCapture) => void = () => {}
    startMicCapture.mockImplementationOnce(
      () => new Promise<MicCapture>((resolve) => (openMic = resolve))
    )

    const starting = controller.start('m-1')
    await vi.waitFor(() => expect(startMicCapture).toHaveBeenCalled())
    const stopping = controller.stopQuietly()
    openMic(capture)
    await Promise.all([stopping, starting])

    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(recordings.discard).toHaveBeenCalledWith('rec-1')
    expect(recordings.stop).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ state: 'idle', meetingId: null })
  })

  it('ses blokları seviye ve süreyi günceller; durdurunca sıfırlanır', async () => {
    const { controller, handlers } = createHarness()
    await controller.start('m-1')

    handlers.current?.onLevel(0.4, 100)
    handlers.current?.onLevel(0.2, 100)
    expect(controller.getSnapshot()).toMatchObject({ level: 0.2, elapsedMs: 200, silent: false })

    await controller.stop()
    expect(controller.getSnapshot()).toMatchObject({ level: 0, elapsedMs: 0, silent: false })
  })

  it('eşik süresi boyunca sessizlikte uyarı açılır, ses gelince kapanır', async () => {
    const { controller, handlers } = createHarness()
    await controller.start('m-1')
    const quiet = SILENT_MIC_PEAK_THRESHOLD / 10

    handlers.current?.onLevel(quiet, SILENT_MIC_WARNING_MS - 1)
    expect(controller.getSnapshot().silent).toBe(false)
    handlers.current?.onLevel(quiet, 1)
    expect(controller.getSnapshot().silent).toBe(true)
    handlers.current?.onLevel(SILENT_MIC_PEAK_THRESHOLD * 10, 100)
    expect(controller.getSnapshot().silent).toBe(false)
  })

  it('yeni Recording süreyi sıfırdan sayar', async () => {
    const { controller, handlers } = createHarness()
    await controller.start('m-1')
    handlers.current?.onLevel(0.4, 500)
    await controller.stop()

    await controller.start('m-1')

    expect(controller.getSnapshot().elapsedMs).toBe(0)
  })

  it('stopQuietly, başlatma iptal edilirken temizlik bitene kadar bekler', async () => {
    const { controller, recordings, capture, startMicCapture } = createHarness()
    let openMic: (capture: MicCapture) => void = () => {}
    startMicCapture.mockImplementationOnce(
      () => new Promise<MicCapture>((resolve) => (openMic = resolve))
    )
    const starting = controller.start('m-1')
    await vi.waitFor(() => expect(startMicCapture).toHaveBeenCalled())

    let settled = false
    const stopping = controller.stopQuietly().then(() => (settled = true))
    await Promise.resolve()
    expect(settled).toBe(false)

    openMic(capture)
    await Promise.all([stopping, starting])

    // Meeting silmek için çağıran bu noktada devam eder: boş Recording çoktan silinmiş olmalı.
    expect(recordings.discard).toHaveBeenCalledWith('rec-1')
    expect(controller.getSnapshot().state).toBe('idle')
  })

  it('durdurma sürerken gelen ikinci istek, Recording bitene kadar bekler', async () => {
    const { controller, recordings } = createHarness()
    let releaseStop: () => void = () => {}
    recordings.stop.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => (releaseStop = resolve))
      return { ok: true, value: summary('rec-1', 'm-1') }
    })
    await controller.start('m-1')
    const first = controller.stop()
    await vi.waitFor(() => expect(recordings.stop).toHaveBeenCalled())

    let settled = false
    const second = controller.stopQuietly().then(() => (settled = true))
    await Promise.resolve()
    expect(settled).toBe(false)

    releaseStop()
    await Promise.all([first, second])

    expect(settled).toBe(true)
    expect(controller.getSnapshot().state).toBe('idle')
  })
})
