import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from '../db/database'
import { LANGUAGES } from '../../shared/meeting'
import type { Language, MeetingErrorCode, MeetingState, MeetingSummary } from '../../shared/meeting'

export class MeetingError extends Error {
  constructor(
    readonly code: MeetingErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'MeetingError'
  }
}

interface MeetingRow {
  id: string
  language: Language
  state: MeetingState
  last_error: string | null
  created_at: number
  closed_at: number | null
  approved_at: number | null
  recording_count: number
}

function toSummary(row: MeetingRow): MeetingSummary {
  return {
    id: row.id,
    language: row.language,
    state: row.state,
    lastError: row.last_error,
    createdAt: row.created_at,
    closedAt: row.closed_at,
    approvedAt: row.approved_at,
    recordingCount: row.recording_count
  }
}

// docs/meeting-lifecycle.md → Geçiş kuralları (Approved'a kadar olan kısım)
const ALLOWED_TRANSITIONS: Record<MeetingState, MeetingState[]> = {
  recording: ['closed'],
  closed: ['transcribing'],
  transcribing: ['transcribed', 'closed'],
  transcribed: ['approved'],
  approved: []
}

const SELECT_MEETING = `
  SELECT m.*, (SELECT COUNT(*) FROM recordings r WHERE r.meeting_id = m.id) AS recording_count
  FROM meetings m
`

// Meeting servisinin Recording servisinden bilmesi gereken iki şey (bkz. src/main/recordings).
export interface ActiveRecordings {
  hasActive: (meetingId: string) => boolean
  abortMeeting: (meetingId: string) => void
}

const NO_ACTIVE_RECORDINGS: ActiveRecordings = { hasActive: () => false, abortMeeting: () => {} }

export interface MeetingServiceOptions {
  db: Db
  recordingsDir: string
  activeRecordings?: ActiveRecordings
  now?: () => number
}

export interface MeetingService {
  start: (language: Language) => MeetingSummary
  get: (id: string) => MeetingSummary
  list: () => MeetingSummary[]
  transition: (id: string, to: MeetingState) => MeetingSummary
  close: (id: string) => MeetingSummary
  remove: (id: string) => void
}

export function createMeetingService({
  db,
  recordingsDir,
  activeRecordings = NO_ACTIVE_RECORDINGS,
  now = Date.now
}: MeetingServiceOptions): MeetingService {
  function get(id: string): MeetingSummary {
    const row = db.prepare(`${SELECT_MEETING} WHERE m.id = ?`).get(id) as MeetingRow | undefined
    if (!row) throw new MeetingError('not-found', 'Meeting bulunamadı.')
    return toSummary(row)
  }

  function list(): MeetingSummary[] {
    const rows = db
      .prepare(`${SELECT_MEETING} ORDER BY m.created_at DESC, m.rowid DESC`)
      .all() as MeetingRow[]
    return rows.map(toSummary)
  }

  function start(language: Language): MeetingSummary {
    if (!LANGUAGES.includes(language)) {
      throw new MeetingError('invalid-input', 'Desteklenmeyen Meeting dili.')
    }
    const open = db.prepare("SELECT 1 FROM meetings WHERE state = 'recording'").get()
    if (open) {
      throw new MeetingError(
        'meeting-already-recording',
        'Devam eden bir Meeting var; yenisini başlatmadan önce onu kapat ya da sil.'
      )
    }
    const id = randomUUID()
    db.prepare(
      "INSERT INTO meetings (id, language, state, created_at) VALUES (?, ?, 'recording', ?)"
    ).run(id, language, now())
    return get(id)
  }

  function transition(id: string, to: MeetingState): MeetingSummary {
    const meeting = get(id)
    if (!ALLOWED_TRANSITIONS[meeting.state].includes(to)) {
      throw new MeetingError(
        'invalid-transition',
        `Meeting ${meeting.state} durumundan ${to} durumuna geçemez.`
      )
    }
    if (meeting.state === 'recording' && to === 'closed' && meeting.recordingCount === 0) {
      throw new MeetingError(
        'no-recordings',
        "Recording'i olmayan Meeting kapatılamaz; silebilirsin."
      )
    }
    const at = now()
    db.prepare(
      `UPDATE meetings SET state = ?,
         closed_at = CASE WHEN ? = 'closed' AND state = 'recording' THEN ? ELSE closed_at END,
         approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END
       WHERE id = ?`
    ).run(to, to, at, to, at, id)
    return get(id)
  }

  function close(id: string): MeetingSummary {
    const meeting = get(id)
    if (meeting.state !== 'recording') {
      throw new MeetingError('invalid-transition', 'Yalnızca devam eden Meeting kapatılabilir.')
    }
    if (activeRecordings.hasActive(id)) {
      throw new MeetingError(
        'recording-active',
        'Sürmekte olan kaydı durdurmadan Meeting kapatılamaz.'
      )
    }
    return transition(id, 'closed')
  }

  // Approved'dan önce her durumda silinebilir (docs/meeting-lifecycle.md → Silme).
  // Önce kayıt, sonra dosyalar: dosya silme hatası veri kaybettirmez, yalnızca artık klasör bırakır.
  function remove(id: string): void {
    const meeting = get(id)
    if (meeting.state === 'approved') {
      throw new MeetingError('approved-immutable', 'Onaylanmış Meeting silinemez.')
    }
    // Yazıcı, dosyalar ve satırlar silinmeden önce kapatılır; aksi halde silinen klasöre yazmaya devam eder.
    activeRecordings.abortMeeting(id)
    db.prepare('DELETE FROM meetings WHERE id = ?').run(id)
    rmSync(join(recordingsDir, id), { recursive: true, force: true })
  }

  return { start, get, list, transition, close, remove }
}
