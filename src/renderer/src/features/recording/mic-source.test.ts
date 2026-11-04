import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { AudioSourceHandlers } from './audio-source'
import { createMicSource } from './mic-source'

const pipeline = {
  stop: vi.fn(async () => {}),
  replaceStream: vi.fn()
}
vi.mock('./pcm-pipeline', () => ({ startPcmPipeline: vi.fn(async () => pipeline) }))

// Sahte akış: yalnızca 'ended' dinleyicisi ve track kapatma izlenir.
function fakeStream(): { stream: MediaStream; end: () => void; stopped: () => boolean } {
  let listener: (() => void) | undefined
  let stopped = false
  const track = {
    addEventListener: (_type: string, callback: () => void) => {
      listener = callback
    },
    stop: () => {
      stopped = true
    }
  }
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track]
  } as unknown as MediaStream
  return { stream, end: () => listener?.(), stopped: () => stopped }
}

function domError(name: string): DOMException {
  return new DOMException('fake', name)
}

function handlers(): AudioSourceHandlers & {
  onEnded: Mock<() => void>
  onSwitched: Mock<() => void>
} {
  return {
    onChunk: vi.fn(),
    onLevel: vi.fn(),
    onEnded: vi.fn<() => void>(),
    onSwitched: vi.fn<() => void>()
  }
}

const getUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>()
beforeEach(() => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  getUserMedia.mockReset()
  pipeline.stop.mockClear()
  pipeline.replaceStream.mockClear()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function audioConstraints(call: number): MediaTrackConstraints {
  return getUserMedia.mock.calls[call][0].audio as MediaTrackConstraints
}

describe('createMicSource: cihaz seçimi', () => {
  it('seçim yokken cihaz belirtmeden açar (sistem varsayılanı)', async () => {
    getUserMedia.mockResolvedValueOnce(fakeStream().stream)

    await createMicSource().start(handlers())

    expect(audioConstraints(0)).not.toHaveProperty('deviceId')
    expect(audioConstraints(0)).toMatchObject({ channelCount: 1, echoCancellation: false })
  })

  it('seçili cihazı exact deviceId ile açar', async () => {
    getUserMedia.mockResolvedValueOnce(fakeStream().stream)

    await createMicSource({ selection: { deviceId: 'usb-1', label: 'USB Mic' } }).start(handlers())

    expect(audioConstraints(0)).toMatchObject({ deviceId: { exact: 'usb-1' } })
  })

  it('seçili cihaz yoksa (OverconstrainedError) varsayılana düşer ve haber verir', async () => {
    const onFallback = vi.fn()
    getUserMedia
      .mockRejectedValueOnce(domError('OverconstrainedError'))
      .mockResolvedValueOnce(fakeStream().stream)

    await createMicSource({
      selection: { deviceId: 'usb-1', label: 'USB Mic' },
      onFallback
    }).start(handlers())

    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(audioConstraints(1)).not.toHaveProperty('deviceId')
    expect(onFallback).toHaveBeenCalledWith({ reason: 'not-found', label: 'USB Mic' })
  })

  it('izin reddi (NotAllowedError) varsayılana düşmez, olduğu gibi iletilir', async () => {
    getUserMedia.mockRejectedValueOnce(domError('NotAllowedError'))

    const start = createMicSource({ selection: { deviceId: 'usb-1', label: 'USB Mic' } }).start(
      handlers()
    )

    await expect(start).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('varsayılan mikrofon da yoksa açılış hata verir', async () => {
    getUserMedia
      .mockRejectedValueOnce(domError('OverconstrainedError'))
      .mockRejectedValueOnce(domError('NotFoundError'))

    const start = createMicSource({ selection: { deviceId: 'usb-1', label: 'USB Mic' } }).start(
      handlers()
    )

    await expect(start).rejects.toMatchObject({ name: 'NotFoundError' })
  })
})

describe('createMicSource: kayıt sırasında kopma', () => {
  it('mikrofon koparsa varsayılana geçer: onEnded çağrılmaz, hat yeni akışa bağlanır', async () => {
    const first = fakeStream()
    const second = fakeStream()
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
    const onFallback = vi.fn()
    const h = handlers()
    await createMicSource({
      selection: { deviceId: 'usb-1', label: 'USB Mic' },
      onFallback
    }).start(h)

    first.end()

    await vi.waitFor(() => expect(pipeline.replaceStream).toHaveBeenCalledWith(second.stream))
    expect(audioConstraints(1)).not.toHaveProperty('deviceId')
    expect(h.onEnded).not.toHaveBeenCalled()
    expect(h.onSwitched).toHaveBeenCalledTimes(1)
    expect(onFallback).toHaveBeenCalledWith({ reason: 'disconnected' })
  })

  it('geçişten sonra yeni cihaz da koparsa tekrar geçer', async () => {
    const first = fakeStream()
    const second = fakeStream()
    const third = fakeStream()
    getUserMedia
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream)
      .mockResolvedValueOnce(third.stream)
    const h = handlers()
    await createMicSource().start(h)

    first.end()
    await vi.waitFor(() => expect(pipeline.replaceStream).toHaveBeenCalledTimes(1))
    second.end()
    await vi.waitFor(() => expect(pipeline.replaceStream).toHaveBeenCalledTimes(2))

    expect(pipeline.replaceStream).toHaveBeenLastCalledWith(third.stream)
    expect(h.onEnded).not.toHaveBeenCalled()
  })

  it('varsayılan mikrofon açılamazsa (cihaz yok, izin geri alındı) Recording biter', async () => {
    const first = fakeStream()
    getUserMedia
      .mockResolvedValueOnce(first.stream)
      .mockRejectedValueOnce(domError('NotAllowedError'))
    const h = handlers()
    await createMicSource().start(h)

    first.end()

    await vi.waitFor(() => expect(h.onEnded).toHaveBeenCalledTimes(1))
    expect(pipeline.replaceStream).not.toHaveBeenCalled()
    expect(h.onSwitched).not.toHaveBeenCalled()
  })

  it('geçiş sürerken stop() çağrılırsa yeni akış sızdırılmaz ve onEnded çağrılmaz', async () => {
    const first = fakeStream()
    const second = fakeStream()
    let resolveSecond: (stream: MediaStream) => void = () => {}
    getUserMedia.mockResolvedValueOnce(first.stream).mockReturnValueOnce(
      new Promise<MediaStream>((resolve) => {
        resolveSecond = resolve
      })
    )
    const h = handlers()
    const source = createMicSource()
    await source.start(h)

    first.end()
    await source.stop()
    resolveSecond(second.stream)

    await vi.waitFor(() => expect(second.stopped()).toBe(true))
    expect(pipeline.replaceStream).not.toHaveBeenCalled()
    expect(h.onEnded).not.toHaveBeenCalled()
  })

  it('elle stop() sonrası gelen ended olayı yok sayılır', async () => {
    const first = fakeStream()
    getUserMedia.mockResolvedValueOnce(first.stream)
    const h = handlers()
    const source = createMicSource()
    await source.start(h)

    await source.stop()
    first.end()

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(h.onEnded).not.toHaveBeenCalled()
  })
})
