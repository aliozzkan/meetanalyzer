import { describe, expect, it } from 'vitest'
import { buildWhisperArgs, whisperThreads } from './whisper-args'

describe('buildWhisperArgs', () => {
  // Kaynak: ticket 08 ve spec "Transcription": whisper-cli -m <model> -f <wav> -l <tr|en> --vad --vad-model <vad> -ojf -of <out> -t <threads>
  it('ticket’taki komut satırını Meeting dili ve çıktı önekiyle kurar; ilerleme için -pp ekler', () => {
    const args = buildWhisperArgs({
      modelPath: '/m/model.bin',
      wavPath: '/r/mic.wav',
      language: 'tr',
      vadModelPath: '/v/silero.bin',
      outputPrefix: '/tmp/out',
      threads: 4
    })

    expect(args).toEqual([
      '-m',
      '/m/model.bin',
      '-f',
      '/r/mic.wav',
      '-l',
      'tr',
      '--vad',
      '--vad-model',
      '/v/silero.bin',
      '--vad-samples-overlap',
      '0.1',
      '-ojf',
      '-of',
      '/tmp/out',
      '-t',
      '4',
      '-pp'
    ])
  })

  it('VAD örtüşmesi açıkça verilir: parser’ın zaman eşlemesi whisper varsayılanına güvenmez', () => {
    const args = buildWhisperArgs({
      modelPath: 'm',
      wavPath: 'w',
      language: 'en',
      vadModelPath: 'v',
      outputPrefix: 'o',
      threads: 2
    })

    expect(args[args.indexOf('--vad-samples-overlap') + 1]).toBe('0.1')
  })

  it('dil her zaman Meeting’in dilidir; otomatik algılama (auto) hiç kullanılmaz', () => {
    const base = {
      modelPath: 'm',
      wavPath: 'w',
      vadModelPath: 'v',
      outputPrefix: 'o',
      threads: 2
    } as const

    const tr = buildWhisperArgs({ ...base, language: 'tr' })
    const en = buildWhisperArgs({ ...base, language: 'en' })

    expect(tr[tr.indexOf('-l') + 1]).toBe('tr')
    expect(en[en.indexOf('-l') + 1]).toBe('en')
    expect([...tr, ...en]).not.toContain('auto')
  })
})

describe('whisperThreads', () => {
  // docs/tuning.md: performans çekirdeklerinin yarısı, en az 2
  it.each([
    [10, 5],
    [8, 4],
    [4, 2],
    [3, 2],
    [2, 2],
    [1, 2]
  ])('%i performans çekirdeği -> %i thread', (performanceCores, expected) => {
    expect(whisperThreads(performanceCores)).toBe(expected)
  })
})
