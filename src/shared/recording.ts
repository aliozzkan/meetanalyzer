// Main, preload ve renderer'ın ortak kullandığı Recording tipleri.
// Terimler: GLOSSARY.md (Recording)

import type { IpcResult } from './ipc-result'

export interface RecordingSummary {
  id: string
  meetingId: string
  seq: number
  startedAt: number
  endedAt: number | null
  durationMs: number | null
}

export type RecordingErrorCode =
  | 'microphone-denied'
  | 'meeting-not-recording'
  | 'recording-already-active'
  | 'unknown-recording'
  | 'invalid-chunk'
  | 'internal-error'

export type RecordingResult<T> = IpcResult<T, RecordingErrorCode>
