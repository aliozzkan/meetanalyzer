import { useState } from 'react'
import { Toaster } from './components/ui/sonner'
import { MeetingDetail } from './features/meetings/meeting-detail'
import { MeetingList } from './features/meetings/meeting-list'
import { useMeetings } from './features/meetings/use-meetings'
import { ModelCard } from './features/model/model-card'
import { useModel } from './features/model/use-model'
import { useTranscription } from './features/transcription/use-transcription'

function App(): React.JSX.Element {
  const api = useMeetings()
  const model = useModel()
  const transcription = useTranscription(model, api.refresh)
  const [openMeetingId, setOpenMeetingId] = useState<string | null>(null)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-heading">Meetanalyzing</h1>
      <ModelCard
        model={model}
        forceAsk={transcription.askingModel}
        onSkip={transcription.declineModel}
      />
      {openMeetingId ? (
        <MeetingDetail
          api={api}
          transcription={transcription}
          meetingId={openMeetingId}
          onBack={() => setOpenMeetingId(null)}
        />
      ) : (
        <MeetingList api={api} transcription={transcription} onOpen={setOpenMeetingId} />
      )}
      <Toaster />
    </main>
  )
}

export default App
