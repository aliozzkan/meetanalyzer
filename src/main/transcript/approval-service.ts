import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  composeApprovedBlocks,
  formatApprovedBlocks,
  type ApprovedBlock,
  type ApprovedTranscript
} from '../../shared/transcript'
import type { Db } from '../db/database'
import type { MeetingService } from '../meetings/meeting-service'
import { TranscriptError, type TranscriptService } from './transcript-service'

export interface ApprovalService {
  /** Transcribed Meeting'in Transcript'ini dondurur, Meeting'i Approved yapar ve ses dosyalarını siler. */
  approve: (meetingId: string) => void
  /** Düz metin görünümü ("Sen: …" / "Diğerleri: …"); bu dilimden önce onaylananlarda eski tek metin. */
  getApprovedText: (meetingId: string) => string
  /** Dondurulmuş Side blokları ve düz metin; eski tek metinli Transcript'ler tek bir Self bloğu sayılır. */
  getApproved: (meetingId: string) => ApprovedTranscript
}

type RemoveDir = (path: string) => void
const removeDirRecursive: RemoveDir = (path) => rmSync(path, { recursive: true, force: true })

// Approved Meeting'lerin ses klasörünü siler ve `file_path`'i temizler. Silme başarısızsa yol DB'de kalır ki
// sonraki çağrı (açılışta) yeniden denesin. Yolları zaten temizlenmiş ama klasörü kalmış Meeting de silinir.
// Temizlenen Meeting sayısını döndürür.
export function purgeApprovedAudio({
  db,
  recordingsDir,
  meetingId,
  removeDir = removeDirRecursive
}: {
  db: Db
  recordingsDir: string
  /** Verilirse yalnızca bu Meeting; yoksa tüm Approved Meeting'ler. */
  meetingId?: string
  removeDir?: RemoveDir
}): number {
  const rows = db
    .prepare(
      `SELECT m.id,
              EXISTS (SELECT 1 FROM recordings r JOIN recording_channels c ON c.recording_id = r.id
                      WHERE r.meeting_id = m.id AND c.file_path IS NOT NULL) AS has_paths
       FROM meetings m WHERE m.state = 'approved' ${meetingId ? 'AND m.id = ?' : ''}`
    )
    .all(...(meetingId ? [meetingId] : [])) as { id: string; has_paths: number }[]

  let purged = 0
  for (const { id, has_paths } of rows) {
    if (!has_paths && !existsSync(join(recordingsDir, id))) continue
    try {
      removeDir(join(recordingsDir, id))
    } catch (error) {
      console.error(`Ses klasörü silinemedi (${id}); açılışta yeniden denenecek:`, error)
      continue
    }
    db.prepare(
      `UPDATE recording_channels SET file_path = NULL
       WHERE recording_id IN (SELECT id FROM recordings WHERE meeting_id = ?)`
    ).run(id)
    purged += 1
  }
  return purged
}

export function createApprovalService({
  db,
  recordingsDir,
  transcripts,
  meetings,
  removeDir,
  now = Date.now
}: {
  db: Db
  recordingsDir: string
  now?: () => number
  transcripts: Pick<TranscriptService, 'get'>
  meetings: Pick<MeetingService, 'transition'>
  removeDir?: RemoveDir
}): ApprovalService {
  function approve(meetingId: string): void {
    const meeting = db.prepare('SELECT state FROM meetings WHERE id = ?').get(meetingId) as
      { state: string } | undefined
    if (!meeting) throw new TranscriptError('meeting-not-found', 'Meeting bulunamadı.')
    if (meeting.state !== 'transcribed') {
      throw new TranscriptError(
        'not-approvable',
        'Yalnızca düzeltmeye hazır Meeting onaylanabilir.'
      )
    }

    // Metin ve durum tek işlemde yazılır; yarım onay kalmaz.
    db.transaction(() => {
      const blocks = composeApprovedBlocks(transcripts.get(meetingId))
      db.prepare(
        'INSERT INTO approved_transcripts (meeting_id, text, blocks, created_at) VALUES (?, ?, ?, ?)'
      ).run(meetingId, formatApprovedBlocks(blocks), JSON.stringify(blocks), now())
      meetings.transition(meetingId, 'approved')
    })()

    // Onay kesinleşti; ses silme hatası onayı geri almaz (açılışta yeniden denenir).
    purgeApprovedAudio({ db, recordingsDir, meetingId, removeDir })
  }

  function getRow(meetingId: string): { text: string; blocks: string | null } {
    const row = db
      .prepare('SELECT text, blocks FROM approved_transcripts WHERE meeting_id = ?')
      .get(meetingId) as { text: string; blocks: string | null } | undefined
    if (!row) throw new TranscriptError('not-approved', 'Bu Meeting onaylanmamış.')
    return row
  }

  function getApprovedText(meetingId: string): string {
    return getRow(meetingId).text
  }

  function getApproved(meetingId: string): ApprovedTranscript {
    const { text, blocks } = getRow(meetingId)
    if (blocks === null) {
      // Side bilgisinden önce onaylanmış: yalnızca mikrofon vardı, tek bir Self bloğu.
      return { blocks: text === '' ? [] : [{ side: 'self', text }], text }
    }
    return { blocks: JSON.parse(blocks) as ApprovedBlock[], text }
  }

  return { approve, getApprovedText, getApproved }
}
