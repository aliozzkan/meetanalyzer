import { Fragment, memo, useMemo } from 'react'
import {
  SIDE_LABEL,
  countUncorrected,
  groupIntoBlocks,
  type TranscriptRecording,
  type TranscriptSegment
} from '@shared/transcript'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { SuspectWord } from './suspect-word'
import type { TranscriptApi } from './use-transcript'

interface SegmentProps {
  segment: TranscriptSegment
  onCorrect: TranscriptApi['correct']
  onRevert: TranscriptApi['revert']
}

// Uzun Transcript'te (1 saat ≈ 10k kelime) kaydırma akıcı kalsın diye: segment memo'ludur (bir Correction
// yalnızca kendi segmentini yeniden çizer), Suspect olmayan kelimeler düz metindir ve ekran dışı
// segmentlerin düzeni/boyaması `content-visibility: auto` ile tarayıcıca atlanır.
const Segment = memo(function Segment({
  segment,
  onCorrect,
  onRevert
}: SegmentProps): React.JSX.Element {
  return (
    <p className="leading-7 [contain-intrinsic-size:auto_3.5rem] [content-visibility:auto]">
      {segment.words.map((word, index) => (
        <Fragment key={word.id}>
          {index > 0 && ' '}
          {word.isSuspect ? (
            <SuspectWord word={word} onCorrect={onCorrect} onRevert={onRevert} />
          ) : (
            word.text
          )}
        </Fragment>
      ))}
    </p>
  )
})

interface RecordingSectionProps {
  recording: TranscriptRecording
  onCorrect: TranscriptApi['correct']
  onRevert: TranscriptApi['revert']
}

// Bir Recording'in segmentleri "Sen" / "Diğerleri" etiketli bloklar halinde gösterilir (ardışık aynı Side'lı
// segmentler tek blok). Bir Correction yalnızca kendi Recording'ini yeniden hesaplatır.
const RecordingSection = memo(function RecordingSection({
  recording,
  onCorrect,
  onRevert
}: RecordingSectionProps): React.JSX.Element {
  const blocks = useMemo(() => groupIntoBlocks(recording.segments), [recording.segments])
  return (
    <>
      {blocks.map((block, index) => (
        <section
          key={`${block.segments[0].id}-${index}`}
          aria-label={SIDE_LABEL[block.side]}
          className="flex flex-col gap-1"
        >
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {SIDE_LABEL[block.side]}
          </span>
          {block.segments.map((segment) => (
            <Segment key={segment.id} segment={segment} onCorrect={onCorrect} onRevert={onRevert} />
          ))}
        </section>
      ))}
    </>
  )
})

// Transcribed Meeting'in Transcript'i: salt okunur; yalnızca Suspect Word'ler tıklanabilir.
export function TranscriptView({ api }: { api: TranscriptApi }): React.JSX.Element {
  const { transcript } = api
  const suspects = useMemo(() => (transcript ? countUncorrected(transcript) : 0), [transcript])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcript</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!transcript ? (
          <p>Yükleniyor…</p>
        ) : (
          <>
            <p className="text-sm">
              {suspects === 0
                ? 'Düzeltilmemiş şüpheli kelime kalmadı.'
                : `${suspects} şüpheli kelime düzeltilmedi. Vurgulu kelimelere tıklayarak düzeltebilirsin.`}
            </p>
            {transcript.recordings.map((recording, index) => (
              <Fragment key={recording.id}>
                {index > 0 && (
                  <hr aria-label="Kayıt sınırı" className="my-2 border-t border-border/40" />
                )}
                <RecordingSection
                  recording={recording}
                  onCorrect={api.correct}
                  onRevert={api.revert}
                />
              </Fragment>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
