import { useState } from 'react'
import { useNavigate } from 'react-router'
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@shared/meeting'
import { Button } from '@renderer/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@renderer/components/ui/native-select'
import { LANGUAGE_LABELS } from '../../features/meetings/labels'
import { ModelCard } from '../../features/model/model-card'
import { useAppContext } from '../app-context'
import { paths } from '../paths'

// Geçici Home: kalıcı hâli (CTA, işlem bekleyenler) issue 06'da; Yeni Meeting butonu issue 03'te sidebar'a taşınır.
export function HomePage(): React.JSX.Element {
  const { meetings, model, transcription } = useAppContext()
  const navigate = useNavigate()
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE)
  const hasOpenMeeting = meetings.meetings.some((meeting) => meeting.state === 'recording')

  async function handleStart(): Promise<void> {
    const meeting = await meetings.start(language)
    if (meeting) void navigate(paths.meeting(meeting.id))
  }

  return (
    <>
      <h1 className="text-2xl font-heading">Meetanalyzing</h1>
      <ModelCard
        model={model}
        forceAsk={transcription.askingModel}
        onSkip={transcription.declineModel}
      />
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect
          aria-label="Meeting dili"
          value={language}
          onChange={(event) => setLanguage(event.target.value as Language)}
        >
          {LANGUAGES.map((code) => (
            <NativeSelectOption key={code} value={code}>
              {LANGUAGE_LABELS[code]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button onClick={handleStart} disabled={hasOpenMeeting}>
          Yeni Meeting
        </Button>
        {hasOpenMeeting && (
          <span className="text-sm">
            Devam eden bir Meeting var; yenisi için onu kapat ya da sil.
          </span>
        )}
      </div>
    </>
  )
}
