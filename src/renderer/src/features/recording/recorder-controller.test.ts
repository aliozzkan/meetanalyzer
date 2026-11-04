import { describe, expect, it, vi } from 'vitest'
import {
  MIC_SPEECH_MIN_MS,
  SILENT_MIC_PEAK_THRESHOLD,
  SILENT_MIC_WARNING_MS,
  SYSTEM_AUDIO_HEARD_MIN_MS
} from '@shared/audio'
import type { RecordingSummary } from '@shared/recording'
import { AudioPermissionError, type AudioSource, type AudioSourceHandlers } from './audio-source'
import { createRecorderController, type RecorderDeps } from './recorder-controller'

type Recordings = RecorderDeps['recordings']

function summary(id: string, meetingId: string): RecordingSummary {
  return { id, meetingId, seq: 1, startedAt: 0, endedAt: null, durationMs: null }
}

// Sınırdaki bağımlılıklar (ana süreç IPC'si ve mikrofon) sahtedir; controller'ın kendisi gerçektir.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- tip, donanımın kendisinden çıkarılır
function createHarness() {
  const handlers: { current?: AudioSourceHandlers } = {}
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
  const capture = {
    stop: vi.fn(async () => {
      calls.push('capture.stop')
    })
  }
  const startMicCapture = vi.fn(async (h: AudioSourceHandlers): Promise<void> => {
    handlers.current = h
  })
  const micSource: AudioSource = { start: startMicCapture, stop: capture.stop }
  const notifyError = vi.fn()
  const onRecordingsChanged = vi.fn()
  const controller = createRecorderController({
    recordings,
    createSources: () => ({ mic: micSource }),
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
      ['rec-1', first, 'mic'],
      ['rec-1', second, 'mic']
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
    let openMic: () => void = () => {}
    startMicCapture.mockImplementationOnce(
      () => new Promise<void>((resolve) => (openMic = resolve))
    )

    const starting = controller.start('m-1')
    await vi.waitFor(() => expect(startMicCapture).toHaveBeenCalled())
    const stopping = controller.stopQuietly()
    openMic()
    await Promise.all([stopping, starting])

    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(recordings.discard).toHaveBeenCalledWith('rec-1')
    expect(recordings.stop).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({ state: 'idle', meetingId: null })
  })

  it('kayıt sürerken kaynak kesilirse Recording kendiliğinden biter ve kesilen kanal işaretlenir', async () => {
    const { controller, recordings, capture, notifyError, handlers } = createHarness()
    await controller.start('m-1')

    handlers.current?.onEnded()
    await vi.waitFor(() => expect(controller.getSnapshot().state).toBe('idle'))

    expect(capture.stop).toHaveBeenCalledTimes(1)
    expect(recordings.stop).toHaveBeenCalledTimes(1)
    expect(notifyError).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({
      state: 'idle',
      meetingId: null,
      interrupted: { meetingId: 'm-1', channel: 'mic' }
    })
  })

  it('kullanıcı durdurduktan sonra gelen onEnded yok sayılır; yeni Recording kopma işaretini temizler', async () => {
    const { controller, recordings, handlers } = createHarness()
    await controller.start('m-1')
    await controller.stop()

    handlers.current?.onEnded()
    expect(controller.getSnapshot().interrupted).toBeNull()
    expect(recordings.stop).toHaveBeenCalledTimes(1)

    await controller.start('m-1')
    handlers.current?.onEnded()
    await vi.waitFor(() => expect(controller.getSnapshot().interrupted).not.toBeNull())
    await controller.start('m-1')
    expect(controller.getSnapshot().interrupted).toBeNull()
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

  it('mikrofon başka bir cihaza geçince sessizlik sayacı yeni cihaz için baştan başlar; Recording sürer', async () => {
    const { controller, handlers } = createHarness()
    await controller.start('m-1')
    const quiet = SILENT_MIC_PEAK_THRESHOLD / 10

    handlers.current?.onLevel(quiet, SILENT_MIC_WARNING_MS)
    expect(controller.getSnapshot().silent).toBe(true)

    handlers.current?.onSwitched?.()
    expect(controller.getSnapshot()).toMatchObject({ state: 'recording', silent: false })
    handlers.current?.onLevel(quiet, SILENT_MIC_WARNING_MS - 1)
    expect(controller.getSnapshot().silent).toBe(false)
    handlers.current?.onLevel(quiet, 1)
    expect(controller.getSnapshot().silent).toBe(true)
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
    const { controller, recordings, startMicCapture } = createHarness()
    let openMic: () => void = () => {}
    startMicCapture.mockImplementationOnce(
      () => new Promise<void>((resolve) => (openMic = resolve))
    )
    const starting = controller.start('m-1')
    await vi.waitFor(() => expect(startMicCapture).toHaveBeenCalled())

    let settled = false
    const stopping = controller.stopQuietly().then(() => (settled = true))
    await Promise.resolve()
    expect(settled).toBe(false)

    openMic()
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

describe('createRecorderController: mikrofon + sistem sesi', () => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- tip, donanımın kendisinden çıkarılır
  function createTwoSourceHarness() {
    const handlers: Partial<Record<'mic' | 'system', AudioSourceHandlers>> = {}
    const calls: string[] = []
    const makeSource = (channel: 'mic' | 'system'): AudioSource => ({
      start: vi.fn(async (h: AudioSourceHandlers) => {
        calls.push(`${channel}.start`)
        handlers[channel] = h
      }),
      stop: vi.fn(async () => {
        calls.push(`${channel}.stop`)
      })
    })
    const mic = makeSource('mic')
    const system = makeSource('system')
    const recordings = {
      start: vi.fn<Recordings['start']>(async (meetingId) => ({
        ok: true,
        value: summary('rec-1', meetingId)
      })),
      append: vi.fn<Recordings['append']>(async () => ({ ok: true, value: undefined })),
      stop: vi.fn<Recordings['stop']>(async (recordingId) => ({
        ok: true,
        value: summary(recordingId, 'm-1')
      })),
      discard: vi.fn<Recordings['discard']>(async () => {
        calls.push('recordings.discard')
        return { ok: true, value: undefined }
      })
    }
    const notifyError = vi.fn()
    const controller = createRecorderController({
      recordings,
      createSources: () => ({ mic, system }),
      notifyError,
      onRecordingsChanged: vi.fn()
    })
    return { controller, recordings, mic, system, handlers, calls, notifyError }
  }

  it('önce mikrofon, sonra sistem sesi açılır; parçalar kendi kanalıyla gönderilir', async () => {
    const { controller, recordings, handlers, calls } = createTwoSourceHarness()

    await controller.start('m-1')
    expect(calls).toEqual(['mic.start', 'system.start'])

    const micChunk = new Uint8Array([1])
    const systemChunk = new Uint8Array([2])
    handlers.mic?.onChunk(micChunk)
    handlers.system?.onChunk(systemChunk)
    await controller.stop()

    expect(recordings.append.mock.calls).toEqual([
      ['rec-1', micChunk, 'mic'],
      ['rec-1', systemChunk, 'system']
    ])
  })

  it('sistem sesi izni yoksa açılan mikrofon kapatılır, boş Recording silinir ve izin uyarısı işaretlenir', async () => {
    const { controller, system, notifyError, calls } = createTwoSourceHarness()
    vi.mocked(system.start).mockRejectedValueOnce(new AudioPermissionError('system'))

    await controller.start('m-1')

    expect(calls).toEqual(['mic.start', 'mic.stop', 'recordings.discard'])
    expect(notifyError).not.toHaveBeenCalled()
    expect(controller.getSnapshot()).toMatchObject({
      state: 'idle',
      meetingId: null,
      systemAudioDeniedFor: 'm-1',
      microphoneDeniedFor: null
    })
  })

  it('sistem sesi başka bir nedenle açılamazsa hata bildirilir ve Recording başlamaz', async () => {
    const { controller, system, notifyError, recordings } = createTwoSourceHarness()
    vi.mocked(system.start).mockRejectedValueOnce(new Error('cihaz yok'))

    await controller.start('m-1')

    expect(notifyError).toHaveBeenCalledExactlyOnceWith('Sistem sesi açılamadı: cihaz yok')
    expect(recordings.discard).toHaveBeenCalledWith('rec-1')
    expect(controller.getSnapshot()).toMatchObject({ state: 'idle', systemAudioDeniedFor: null })
  })

  it('tüm kaynaklar açılmadan gelen parçalar atılır (kanallar aynı anda başlasın)', async () => {
    const { controller, recordings, system, handlers } = createTwoSourceHarness()
    let openSystem: () => void = () => {}
    vi.mocked(system.start).mockImplementationOnce(
      (h) =>
        new Promise<void>((resolve) => {
          handlers.system = h
          openSystem = resolve
        })
    )

    const starting = controller.start('m-1')
    await vi.waitFor(() => expect(handlers.mic).toBeDefined())
    handlers.mic?.onChunk(new Uint8Array([9])) // sistem sesi henüz açılmadı
    openSystem()
    await starting
    handlers.mic?.onChunk(new Uint8Array([1]))
    await controller.stop()

    expect(recordings.append.mock.calls).toEqual([['rec-1', new Uint8Array([1]), 'mic']])
  })

  it('sistem sesi kopunca Recording biter ve kesilen kanal system olarak işaretlenir', async () => {
    const { controller, mic, system, handlers } = createTwoSourceHarness()
    await controller.start('m-1')

    handlers.system?.onEnded()
    await vi.waitFor(() => expect(controller.getSnapshot().state).toBe('idle'))

    expect(mic.stop).toHaveBeenCalledTimes(1)
    expect(system.stop).toHaveBeenCalledTimes(1)
    expect(controller.getSnapshot().interrupted).toEqual({ meetingId: 'm-1', channel: 'system' })
  })

  it('seviye ve süre: mikrofon "Sen" göstergesini, geçen süre iki kanalın en uzununu izler', async () => {
    const { controller, handlers } = createTwoSourceHarness()
    await controller.start('m-1')

    handlers.mic?.onLevel(0.3, 100)
    handlers.system?.onLevel(0.9, 300)

    expect(controller.getSnapshot()).toMatchObject({ level: 0.3, elapsedMs: 300 })
  })

  it('bilgilendirme kabul edilmediyse (ana süreç reddeder) kabul uyarısı işaretlenir, hata bildirilmez', async () => {
    const { controller, recordings, notifyError, mic } = createTwoSourceHarness()
    recordings.start.mockResolvedValueOnce({
      ok: false,
      code: 'system-audio-consent-required',
      message: 'bilgilendirme gerekli'
    })

    await controller.start('m-1')

    expect(controller.getSnapshot()).toMatchObject({
      state: 'idle',
      meetingId: null,
      consentRequiredFor: 'm-1'
    })
    expect(notifyError).not.toHaveBeenCalled()
    expect(mic.start).not.toHaveBeenCalled()
  })

  it('mikrofonda konuşma var, sistem kanalı sessizse Recording bitince toplantı sesi uyarısı işaretlenir', async () => {
    const { controller, handlers } = createTwoSourceHarness()
    await controller.start('m-1')

    handlers.mic?.onLevel(0.2, MIC_SPEECH_MIN_MS)
    handlers.system?.onLevel(0, 60_000)
    await controller.stop()

    expect(controller.getSnapshot().quietMeetingFor).toBe('m-1')
  })

  it('diğer katılımcılar konuştuysa toplantı sesi uyarısı işaretlenmez', async () => {
    const { controller, handlers } = createTwoSourceHarness()
    await controller.start('m-1')

    handlers.mic?.onLevel(0.2, MIC_SPEECH_MIN_MS)
    handlers.system?.onLevel(0.1, SYSTEM_AUDIO_HEARD_MIN_MS)
    await controller.stop()

    expect(controller.getSnapshot().quietMeetingFor).toBeNull()
  })

  it('kaynak kopmasıyla biten Recording için toplantı sesi uyarısı verilmez; yeni Recording uyarıyı temizler', async () => {
    const { controller, handlers } = createTwoSourceHarness()
    await controller.start('m-1')
    handlers.mic?.onLevel(0.2, MIC_SPEECH_MIN_MS)
    handlers.system?.onEnded()
    await vi.waitFor(() => expect(controller.getSnapshot().state).toBe('idle'))
    expect(controller.getSnapshot().quietMeetingFor).toBeNull()

    await controller.start('m-1')
    handlers.mic?.onLevel(0.2, MIC_SPEECH_MIN_MS)
    await controller.stop()
    expect(controller.getSnapshot().quietMeetingFor).toBe('m-1')

    await controller.start('m-1')
    expect(controller.getSnapshot().quietMeetingFor).toBeNull()
  })

  it('sistem sesi kaynağı olmayan Recording için toplantı sesi uyarısı verilmez', async () => {
    const { controller, handlers } = createHarness()
    await controller.start('m-1')

    handlers.current?.onLevel(0.2, MIC_SPEECH_MIN_MS)
    await controller.stop()

    expect(controller.getSnapshot().quietMeetingFor).toBeNull()
  })
})
