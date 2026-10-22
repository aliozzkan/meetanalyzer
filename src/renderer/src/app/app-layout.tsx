import { Outlet, useNavigate } from 'react-router'
import { Toaster } from '../components/ui/sonner'
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar'
import { useMeetings } from '../features/meetings/use-meetings'
import { useNewMeeting } from '../features/meetings/use-new-meeting'
import { useModel } from '../features/model/use-model'
import { isBusyWith } from '../features/recording/recorder-controller'
import { useRecorder } from '../features/recording/use-recorder'
import { SettingsDialog } from '../features/settings/settings-dialog'
import { useDefaultLanguage } from '../features/settings/use-default-language'
import { useSettingsDialog } from '../features/settings/use-settings-dialog'
import { AppSidebar } from '../features/shell/app-sidebar'
import { sidebarTopState } from '../features/shell/sidebar-top'
import { SidebarTopArea } from '../features/shell/sidebar-top-area'
import { useAppCommands } from '../features/shell/use-app-commands'
import { useHistoryShortcuts } from '../features/shell/use-history-shortcuts'
import { useSidebarOpen } from '../features/shell/use-sidebar-open'
import { useTranscription } from '../features/transcription/use-transcription'
import { IS_MAC } from '../lib/platform'
import { cn } from '../lib/utils'
import type { AppContext } from './app-context'
import { paths } from './paths'
import { DotPattern } from '@renderer/components/ui/dot-pattern'
import { RainbowButton } from '@renderer/components/ui/rainbow-button'

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
  useHistoryShortcuts()
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
    <div className="[--header-height:calc(--spacing(11))]">
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} className="flex flex-col">
        <header className="sticky top-0 z-50 flex w-full items-center border-b bg-background">
          <div className="flex h-(--header-height) w-full items-center gap-2 px-4 relative">
            <div className="app-drag absolute inset-0 w-full h-full z-0"></div>
            <div className="w-full flex justify-end z-10">
              <RainbowButton size="sm" variant="outline" onClick={() => void navigate('/')} className="app-no-drag">
                Planları Görüntüle
              </RainbowButton>
            </div>
          </div>
        </header>
        <div className="flex flex-1">
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
            top={
              <SidebarTopArea
                state={sidebarTopState(meetings.meetings, recorder)}
                defaultLanguage={defaultLanguage.language}
                onStart={(language) => void newMeeting.start(language)}
                onOpen={(id) => void navigate(paths.meeting(id))}
                onStop={() => void recorder.stop()}
              />
            }
          />
          <SidebarInset className="h-[calc(99svh-var(--header-height))] relative">
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
        <SettingsDialog dialog={settings} language={defaultLanguage} />
        <Toaster />
      </SidebarProvider>
    </div>
  )
}
