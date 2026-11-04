import { describe, expect, it } from 'vitest'
import { MEETING_AUDIO_PEAK_THRESHOLD, MIC_SPEECH_MIN_MS, SYSTEM_AUDIO_HEARD_MIN_MS } from './audio'
import { createMeetingAudioTracker, isMeetingSilent } from './meeting-silence'

const LOUD = MEETING_AUDIO_PEAK_THRESHOLD * 10
const QUIET = MEETING_AUDIO_PEAK_THRESHOLD / 10

describe('isMeetingSilent', () => {
  it('mikrofonda konuşma var, sistem kanalı baştan sona sessiz: uyarılır', () => {
    const tracker = createMeetingAudioTracker()
    tracker.feed('mic', LOUD, MIC_SPEECH_MIN_MS)
    tracker.feed('system', QUIET, 60_000)

    expect(isMeetingSilent(tracker.summary())).toBe(true)
  })

  it('diğer katılımcılar konuştuysa uyarılmaz', () => {
    const tracker = createMeetingAudioTracker()
    tracker.feed('mic', LOUD, MIC_SPEECH_MIN_MS)
    tracker.feed('system', LOUD, SYSTEM_AUDIO_HEARD_MIN_MS)

    expect(isMeetingSilent(tracker.summary())).toBe(false)
  })

  it('mikrofon da sessizse (kimse konuşmadı) uyarılmaz', () => {
    const tracker = createMeetingAudioTracker()
    tracker.feed('mic', QUIET, 60_000)
    tracker.feed('system', QUIET, 60_000)

    expect(isMeetingSilent(tracker.summary())).toBe(false)
  })

  it('tek bir kısa gürültü patlaması konuşma ya da toplantı sesi sayılmaz', () => {
    const tracker = createMeetingAudioTracker()
    tracker.feed('mic', LOUD, MIC_SPEECH_MIN_MS - 1)
    tracker.feed('system', LOUD, SYSTEM_AUDIO_HEARD_MIN_MS - 1)

    expect(tracker.summary()).toEqual({ micSpoke: false, systemHeard: false })
  })

  it('ses süresi bölünmüş bloklarda toplanır; eşik tam sınırda geçer', () => {
    const tracker = createMeetingAudioTracker()
    for (let i = 0; i < 8; i++) tracker.feed('mic', LOUD, MIC_SPEECH_MIN_MS / 8)
    tracker.feed('system', MEETING_AUDIO_PEAK_THRESHOLD, SYSTEM_AUDIO_HEARD_MIN_MS)

    expect(tracker.summary()).toEqual({ micSpoke: true, systemHeard: true })
  })

  it('sessiz bloklar süre biriktirmez (sessizlik araya girse de sayaç sıfırlanmaz, yalnızca ses toplanır)', () => {
    const tracker = createMeetingAudioTracker()
    tracker.feed('mic', LOUD, MIC_SPEECH_MIN_MS / 2)
    tracker.feed('mic', QUIET, 30_000)
    tracker.feed('mic', LOUD, MIC_SPEECH_MIN_MS / 2)

    expect(tracker.summary().micSpoke).toBe(true)
  })
})
