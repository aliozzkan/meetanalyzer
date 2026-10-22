import { CornerUpLeftIcon, MicIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { LANGUAGES, type Language } from '@shared/meeting'
import { Button } from '@renderer/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '@renderer/components/ui/empty'
import { NativeSelect, NativeSelectOption } from '@renderer/components/ui/native-select'
import { LANGUAGE_LABELS } from '../../features/meetings/labels'
import { PendingMeetingList } from '../../features/meetings/pending-meeting-list'
import { ModelCard } from '../../features/model/model-card'
import { openMeetingStatus } from '../../features/shell/open-meeting-status'
import { useAppContext } from '../app-context'
import { paths } from '../paths'

// Home (spec: "Home"): büyük "Yeni Meeting" CTA'sı ve dil seçimi, model eksikse onboarding kartı,
// kullanıcıdan işlem bekleyen Meeting'ler. Yeni Meeting sidebar'dan ve ⌘N ile de başlatılır.
export function HomePage(): React.JSX.Element {
  const { meetings, model, transcription, recorder, defaultLanguage, newMeeting } = useAppContext()
  const navigate = useNavigate()
  // Kullanıcı bu ekranda başka bir dil seçmedikçe Default Language önerilir (ayar sonradan yüklense de).
  const [pickedLanguage, setPickedLanguage] = useState<Language | null>(null)
  const language = pickedLanguage ?? defaultLanguage.language
  // Header pill'iyle aynı kural: Recording'de Meeting varken yenisi başlatılamaz, ona dönülür.
  const status = openMeetingStatus(meetings.meetings, recorder)

  return (
    <>
      <Empty className="gap-6 py-12">
        <EmptyHeader className="max-w-md">
          <EmptyMedia
            variant="icon"
            className="size-12 rounded-xl [&_svg:not([class*='size-'])]:size-6"
          >
            <MicIcon />
          </EmptyMedia>
          <EmptyTitle className="text-2xl font-semibold">
            {status.kind === 'none' ? 'Yeni bir Meeting başlat' : 'Açık bir Meeting var'}
          </EmptyTitle>
          <EmptyDescription>
            {status.kind === 'none'
              ? 'Toplantını kaydet, sonra metne döküp düzelt. Ses kayıtların cihazından çıkmaz.'
              : status.kind === 'recording'
                ? 'Kayıt sürüyor. Yeni Meeting için önce açık Meeting’i kapat.'
                : 'Yeni Meeting için önce açık Meeting’i kapat ya da sil.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {status.kind === 'none' ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="lg" className="px-4" onClick={() => void newMeeting.start(language)}>
                <PlusIcon /> Yeni Meeting
              </Button>
              <NativeSelect
                aria-label="Meeting dili"
                value={language}
                onChange={(event) => setPickedLanguage(event.target.value as Language)}
              >
                {LANGUAGES.map((code) => (
                  <NativeSelectOption key={code} value={code}>
                    {LANGUAGE_LABELS[code]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <Button
              size="lg"
              className="px-4"
              onClick={() => void navigate(paths.meeting(status.meetingId))}
            >
              <CornerUpLeftIcon /> Açık Meeting&apos;e dön
            </Button>
          )}
        </EmptyContent>
      </Empty>
      {/* Model eksikse onboarding; "Metne dök" model yokken basıldıysa (forceAsk) atlanmış olsa da sorulur. */}
      <ModelCard
        model={model}
        forceAsk={transcription.askingModel}
        onSkip={transcription.declineModel}
      />
      <PendingMeetingList meetings={meetings.meetings} transcription={transcription.status} />
    </>
  )
}
