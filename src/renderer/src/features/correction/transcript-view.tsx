import { Fragment, memo } from 'react'
import type { TranscriptSegment } from '@shared/transcript'
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

// Transcribed Meeting'in Transcript'i: salt okunur; yalnızca Suspect Word'ler tıklanabilir.
export function TranscriptView({ api }: { api: TranscriptApi }): React.JSX.Element {
  const { transcript } = api
  const suspects = transcript
    ? transcript.recordings.reduce(
        (total, recording) =>
          total +
          recording.segments.reduce(
            (sum, segment) =>
              sum +
              segment.words.filter((word) => word.isSuspect && word.corrected === null).length,
            0
          ),
        0
      )
    : 0

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
                {recording.segments.map((segment) => (
                  <Segment
                    key={segment.id}
                    segment={segment}
                    onCorrect={api.correct}
                    onRevert={api.revert}
                  />
                ))}
              </Fragment>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
