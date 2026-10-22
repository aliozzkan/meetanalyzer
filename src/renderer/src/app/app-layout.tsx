import { Outlet, useNavigate } from 'react-router'
import { Toaster } from '../components/ui/sonner'
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar'
import { useMeetings } from '../features/meetings/use-meetings'
import { useNewMeeting } from '../features/meetings/use-new-meeting'
import { HeaderModelIndicator } from '../features/model/header-model-indicator'
import { useModel } from '../features/model/use-model'
import { isBusyWith } from '../features/recording/recorder-controller'
import { useRecorder } from '../features/recording/use-recorder'
import { SettingsDialog } from '../features/settings/settings-dialog'
import { useDefaultLanguage } from '../features/settings/use-default-language'
import { useSettingsDialog } from '../features/settings/use-settings-dialog'
import { AppHeader } from '../features/shell/app-header'
import { AppSidebar } from '../features/shell/app-sidebar'
import { OpenMeetingPill } from '../features/shell/open-meeting-pill'
import { openMeetingStatus } from '../features/shell/open-meeting-status'
import { SidebarTopArea } from '../features/shell/sidebar-top-area'
import { useAppCommands } from '../features/shell/use-app-commands'
import { useFullScreen } from '../features/shell/use-full-screen'
import { useHistoryNavigation } from '../features/shell/use-history-navigation'
import { useSidebarOpen } from '../features/shell/use-sidebar-open'
import { useTranscription } from '../features/transcription/use-transcription'
import { IS_MAC } from '../lib/platform'
import { cn } from '../lib/utils'
import type { AppContext } from './app-context'
import { paths } from './paths'
import { DotPattern } from '@renderer/components/ui/dot-pattern'

// Uygulama kabuğu: rota değişse de yaşayan durum (Meeting listesi, model, Transcription, Recorder) burada
// tutulur. Recorder'ın burada olması, ekranlar arası gezinmenin Recording'i durdurmamasını sağlar.
export function AppLayout(): React.JSX.Element {
  const meetings = useMeetings()
  const model = useModel()
  const transcription = useTranscription(model, meetings.refresh)
  const recorder = useRecorder(meetings.refresh)
  const defaultLanguage = useDefaultLanguage()
  const settings = useSettingsDialog()
  const newMeeting = useNewMeeting(meetings, defaultLanguage)
  const [sidebarOpen, setSidebarOpen] = useSidebarOpen()
  const navigate = useNavigate()
  const history = useHistoryNavigation()
  const fullScreen = useFullScreen()
  const status = openMeetingStatus(meetings.meetings, recorder)
  useAppCommands({
    'open-settings': () => settings.setOpen(true),
    'new-meeting': newMeeting.startFromShortcut
  })

  const removeMeeting = async (id: string): Promise<boolean> => {
    if (isBusyWith(recorder, id)) await recorder.stopQuietly()
    return meetings.remove(id)
  }

  const context: AppContext = {
    meetings,
    model,
    transcription,
    recorder,
    defaultLanguage,
    newMeeting,
    removeMeeting
  }

  return (
    // Header + içerik pencereyi tam doldurur; sayfa kaymaz, yalnızca içerik alanı kendi içinde kayar.
    <div className="[--header-height:calc(--spacing(11))]">
      <SidebarProvider
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        className="h-svh flex-col overflow-hidden"
      >
        <AppHeader
          history={history}
          fullScreen={fullScreen}
          openMeeting={
            <OpenMeetingPill
              status={status}
              onOpen={(id) => void navigate(paths.meeting(id))}
              onStop={() => void recorder.stop()}
            />
          }
          modelIndicator={
            <HeaderModelIndicator state={model.state} onOpen={() => settings.openAt('model')} />
          }
          // Planlar backlog 10'da; şimdilik yer tutucu.
          onViewPlans={() => void navigate(paths.home)}
        />
        <div className="flex min-h-0 flex-1">
          <AppSidebar
            meetings={meetings}
            transcription={transcription}
            // Açık Meeting silinirse MeetingPage Home'a yönlendirir.
            meetingCommands={{
              rename: meetings.rename,
              close: (id) => void meetings.close(id),
              transcribe: transcription.transcribe,
              remove: (id) => void removeMeeting(id),
              hasActiveRecording: (id) => isBusyWith(recorder, id)
            }}
            onOpenSettings={() => settings.setOpen(true)}
            // Recording'de Meeting varken yeni Meeting başlatılamaz; o Meeting'e header'daki pill'den dönülür.
            top={
              status.kind === 'none' && (
                <SidebarTopArea
                  defaultLanguage={defaultLanguage.language}
                  onStart={(language) => void newMeeting.start(language)}
                />
              )
            }
          />
          <SidebarInset className="min-h-0">
            <DotPattern
              className={cn('mask-[linear-gradient(to_top,white,transparent,transparent)]')}
            />
            <div className="min-h-0 flex-1 overflow-y-auto pt-8 relative z-10">
              <div
                className={cn(
                  'mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 z-10',
                  IS_MAC && 'pt-2'
                )}
              >
                <Outlet context={context} />
              </div>
            </div>
          </SidebarInset>
        </div>
        <SettingsDialog
          dialog={settings}
          language={defaultLanguage}
          model={model}
          transcription={transcription.status}
        />
        <Toaster />
      </SidebarProvider>
    </div>
  )
}
