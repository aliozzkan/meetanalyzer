import { describe, expect, it } from 'vitest'
import { createPowerGuard, type PowerSaveBlockerApi } from './power-guard'

// Electron'un powerSaveBlocker'ının davranışını taklit eder: her start yeni bir id verir.
function fakeBlocker(): { api: PowerSaveBlockerApi; started: string[]; stopped: number[] } {
  const started: string[] = []
  const stopped: number[] = []
  return {
    api: {
      start: (type) => {
        started.push(type)
        return started.length // 1, 2, 3 …
      },
      stop: (id) => {
        stopped.push(id)
      }
    },
    started,
    stopped
  }
}

describe('createPowerGuard', () => {
  it('acquire, uygulamanın askıya alınmasını engelleyen tek bir blocker başlatır', () => {
    const blocker = fakeBlocker()
    const power = createPowerGuard(blocker.api)

    power.acquire('recording')

    expect(blocker.started).toEqual(['prevent-app-suspension'])
    expect(blocker.stopped).toEqual([])
  })

  it('aynı sebep iki kez alınırsa tek blocker kalır', () => {
    const blocker = fakeBlocker()
    const power = createPowerGuard(blocker.api)

    power.acquire('recording')
    power.acquire('recording')

    expect(blocker.started).toHaveLength(1)
  })

  it('release, o sebebin blocker’ını durdurur; fazladan ya da alınmamış release hiçbir şey yapmaz', () => {
    const blocker = fakeBlocker()
    const power = createPowerGuard(blocker.api)

    power.release('recording') // hiç alınmadı
    power.acquire('recording')
    power.release('recording')
    power.release('recording') // zaten bırakıldı

    expect(blocker.stopped).toEqual([1])
  })

  it('sebepler bağımsızdır: biri bırakılınca diğerinin engeli açık kalır', () => {
    const blocker = fakeBlocker()
    const power = createPowerGuard(blocker.api)

    power.acquire('recording') // id 1
    power.acquire('transcription') // id 2
    power.release('recording')

    expect(blocker.started).toHaveLength(2)
    expect(blocker.stopped).toEqual([1]) // transcription'ın 2 numaralı blocker'ı durmadı
  })

  it('bırakıldıktan sonra yeniden alınırsa yeni bir blocker başlar', () => {
    const blocker = fakeBlocker()
    const power = createPowerGuard(blocker.api)

    power.acquire('recording')
    power.release('recording')
    power.acquire('recording')
    power.release('recording')

    expect(blocker.started).toHaveLength(2)
    expect(blocker.stopped).toEqual([1, 2])
  })
})
