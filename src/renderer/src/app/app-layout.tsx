import { Outlet } from 'react-router'
import { Toaster } from '../components/ui/sonner'
import { SidebarInset, SidebarProvider } from '../components/ui/sidebar'
import { useMeetings } from '../features/meetings/use-meetings'
import { useModel } from '../features/model/use-model'
import { isBusyWith } from '../features/recording/recorder-controller'
import { useRecorder } from '../features/recording/use-recorder'
import { SettingsDialog } from '../features/settings/settings-dialog'
import { useDefaultLanguage } from '../features/settings/use-default-language'
import { useSettingsDialog } from '../features/settings/use-settings-dialog'
import { AppSidebar } from '../features/shell/app-sidebar'
import { useHistoryShortcuts } from '../features/shell/use-history-shortcuts'
import { useSidebarOpen } from '../features/shell/use-sidebar-open'
import { useTranscription } from '../features/transcription/use-transcription'
import { IS_MAC } from '../lib/platform'
import { cn } from '../lib/utils'
import type { AppContext } from './app-context'

// Uygulama kabuğu: rota değişse de yaşayan durum (Meeting listesi, model, Transcription, Recorder) burada
// tutulur. Recorder'ın burada olması, ekranlar arası gezinmenin Recording'i durdurmamasını sağlar.
export function AppLayout(): React.JSX.Element {
  const meetings = useMeetings()
  const model = useModel()
  const transcription = useTranscription(model, meetings.refresh)
  const recorder = useRecorder(meetings.refresh)
  const defaultLanguage = useDefaultLanguage()
  const settings = useSettingsDialog()
  const [sidebarOpen, setSidebarOpen] = useSidebarOpen()
  useHistoryShortcuts()

  const context: AppContext = {
    meetings,
    model,
    transcription,
    recorder,
    defaultLanguage,
    removeMeeting: async (id) => {
      if (isBusyWith(recorder, id)) await recorder.stopQuietly()
      return meetings.remove(id)
    }
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar
        meetings={meetings}
        transcription={transcription}
        onOpenSettings={() => settings.setOpen(true)}
      />
      <SidebarInset className="h-svh">
        {/* macOS'ta içerik alanının üstü de pencere sürükleme alanıdır; kaydırılan içeriğin dışında kalır. */}
        {IS_MAC && <div className="app-drag h-8 shrink-0" />}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn('mx-auto flex w-full max-w-3xl flex-col gap-6 p-6', IS_MAC && 'pt-2')}>
            <Outlet context={context} />
          </div>
        </div>
      </SidebarInset>
      <SettingsDialog dialog={settings} language={defaultLanguage} />
      <Toaster />
    </SidebarProvider>
  )
}
