import { describe, expect, it } from 'vitest'
import type { TranscriptionStatus } from '@shared/transcription'
import {
  downloadPercent,
  modelIndicatorState,
  modelStatusLabel,
  removeBlockReason
} from './model-status'

describe('indirme yüzdesi (ModelCard, header göstergesi, Ayarlar)', () => {
  it("tam sayıya yuvarlanır ve 100'ü geçmez", () => {
    expect(downloadPercent(0, 574_041_195)).toBe(0)
    expect(downloadPercent(287_020_598, 574_041_195)).toBe(50)
    expect(downloadPercent(1_000, 3_000)).toBe(33)
    expect(downloadPercent(2_000, 3_000)).toBe(67)
    expect(downloadPercent(1_200, 1_000)).toBe(100)
  })

  it('toplam bilinmiyorsa (0) yüzde 0 sayılır', () => {
    expect(downloadPercent(500, 0)).toBe(0)
  })
})

describe('header model göstergesi', () => {
  it('model hazırken ya da durum henüz okunmamışken hiç gösterilmez', () => {
    expect(modelIndicatorState({ status: 'ready' })).toBeNull()
    expect(modelIndicatorState(null)).toBeNull()
  })

  it('model eksikse (yarım indirme olsa da) "Model indirilmedi" gösterilir', () => {
    expect(modelIndicatorState({ status: 'missing', partialBytes: 0 })).toEqual({ kind: 'missing' })
    expect(modelIndicatorState({ status: 'missing', partialBytes: 300 })).toEqual({
      kind: 'missing'
    })
  })

  it('indirme sürerken yüzde gösterilir', () => {
    expect(
      modelIndicatorState({ status: 'downloading', receivedBytes: 250, totalBytes: 1_000 })
    ).toEqual({ kind: 'downloading', percent: 25 })
  })

  it('indirme başarısızsa hata gösterilir', () => {
    expect(
      modelIndicatorState({ status: 'error', code: 'network', message: 'koptu', partialBytes: 10 })
    ).toEqual({ kind: 'error' })
  })
})

describe('Ayarlar > Transcription Modeli durum etiketi', () => {
  it('hazır model "Hazır", hiç indirilmemiş model "İndirilmedi" görünür', () => {
    expect(modelStatusLabel({ status: 'ready' })).toBe('Hazır')
    expect(modelStatusLabel({ status: 'missing', partialBytes: 0 })).toBe('İndirilmedi')
  })

  it('yarım kalmış indirme boyutuyla gösterilir', () => {
    expect(modelStatusLabel({ status: 'missing', partialBytes: 120_400_000 })).toBe(
      'Yarım kaldı (120 MB)'
    )
  })

  it('indirme sürerken yüzde, tüm baytlar gelince doğrulama gösterilir', () => {
    expect(modelStatusLabel({ status: 'downloading', receivedBytes: 250, totalBytes: 1_000 })).toBe(
      'İndiriliyor · %25'
    )
    expect(
      modelStatusLabel({ status: 'downloading', receivedBytes: 1_000, totalBytes: 1_000 })
    ).toBe('Doğrulanıyor…')
  })

  it('başarısız indirme belirtilir', () => {
    expect(
      modelStatusLabel({ status: 'error', code: 'network', message: 'koptu', partialBytes: 0 })
    ).toBe('İndirme başarısız')
  })
})

describe('model silme ne zaman devre dışı (tooltip nedeni)', () => {
  const idle: TranscriptionStatus = { active: null, queued: [] }
  const ready = { status: 'ready' } as const

  it('hazır, yarım kalmış ya da hatalı model kuyruk boşken silinebilir', () => {
    expect(removeBlockReason(ready, idle)).toBeNull()
    expect(removeBlockReason({ status: 'missing', partialBytes: 300 }, idle)).toBeNull()
    expect(
      removeBlockReason({ status: 'error', code: 'network', message: 'x', partialBytes: 0 }, idle)
    ).toBeNull()
  })

  it('indirme sürerken silinemez', () => {
    expect(
      removeBlockReason({ status: 'downloading', receivedBytes: 1, totalBytes: 10 }, idle)
    ).toBe('İndirme sürerken model silinemez.')
  })

  it("Transcription Queue'da işlenen ya da bekleyen Meeting varken silinemez", () => {
    const reason = 'Metne dökme sürerken ya da sırada Meeting varken model silinemez.'
    expect(removeBlockReason(ready, { active: { meetingId: 'm1', percent: 40 }, queued: [] })).toBe(
      reason
    )
    expect(removeBlockReason(ready, { active: null, queued: ['m2'] })).toBe(reason)
  })

  it('diskte hiçbir şey yoksa silinecek bir şey yoktur', () => {
    expect(removeBlockReason({ status: 'missing', partialBytes: 0 }, idle)).toBe(
      'Silinecek model yok.'
    )
  })
})
