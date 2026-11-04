import {
  MEETING_AUDIO_PEAK_THRESHOLD,
  MIC_SPEECH_MIN_MS,
  SYSTEM_AUDIO_HEARD_MIN_MS,
  type AudioChannel
} from './audio'

export interface MeetingAudioSummary {
  /** Mikrofonda (Self) yeterince konuşma oldu. */
  micSpoke: boolean
  /** Sistem kanalında (Others) yeterince ses duyuldu. */
  systemHeard: boolean
}

export interface MeetingAudioTracker {
  /** Bir ses bloğunun tepe seviyesini ve süresini kanalıyla bildirir. */
  feed: (channel: AudioChannel, peak: number, durationMs: number) => void
  summary: () => MeetingAudioSummary
}

// Süre, gerçek saat yerine beslenen blokların süresinden hesaplanır; böylece deterministiktir (silence-monitor ile aynı).
export function createMeetingAudioTracker(): MeetingAudioTracker {
  const loudMs: Record<AudioChannel, number> = { mic: 0, system: 0 }
  return {
    feed(channel, peak, durationMs) {
      if (peak >= MEETING_AUDIO_PEAK_THRESHOLD) loudMs[channel] += durationMs
    },
    summary: () => ({
      micSpoke: loudMs.mic >= MIC_SPEECH_MIN_MS,
      systemHeard: loudMs.system >= SYSTEM_AUDIO_HEARD_MIN_MS
    })
  }
}

// Mikrofonda konuşma olduğu halde sistem kanalı baştan sona sessiz: diğer katılımcılar konuşmadı, toplantı sesi çalmadı
// ya da sistem sesi izni sorunlu olabilir (çıkış cihazı fark etmez: sistem sesi hangi cihaza çalarsa çalsın yakalanır,
// issue 01 ölçümü). Mikrofon da sessizse (kimse konuşmadı) uyarılmaz: Recording'in kendisi boştur.
export function isMeetingSilent({ micSpoke, systemHeard }: MeetingAudioSummary): boolean {
  return micSpoke && !systemHeard
}
