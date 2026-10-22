import { MicIcon, SquareIcon, TriangleAlertIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { Progress } from '@renderer/components/ui/progress'
import { formatElapsed } from './format-elapsed'
import { isBusyWith } from './recorder-controller'
import type { Recorder } from './use-recorder'

interface Props {
  recorder: Recorder
  /** Kontrollerin ait olduğu Meeting; recorder uygulama genelindedir, başka bir Meeting'de de kayıt sürüyor olabilir. */
  meetingId: string
}

export function RecordingControls({ recorder, meetingId }: Props): React.JSX.Element {
  // Recorder uygulama genelinde tek; yalnızca bu Meeting'in kaydıysa durumunu yansıtırız.
  const here = isBusyWith(recorder, meetingId)
  const busy = here && (recorder.state === 'starting' || recorder.state === 'stopping')
  const recording = here && recorder.state === 'recording'
  const busyElsewhere = recorder.state !== 'idle' && !here
  const start = (): void => void recorder.start(meetingId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        {here && (recording || recorder.state === 'stopping') ? (
          <Button onClick={recorder.stop} disabled={busy}>
            <SquareIcon /> Kaydı durdur
          </Button>
        ) : (
          <Button onClick={start} disabled={busy || busyElsewhere}>
            <MicIcon /> Kaydı başlat
          </Button>
        )}
        {recording && (
          <span className="font-mono text-lg tabular-nums" aria-label="Kayıt süresi">
            {formatElapsed(recorder.elapsedMs)}
          </span>
        )}
      </div>

      {recording && (
        <Progress
          aria-label="Mikrofon ses seviyesi"
          // Konuşma düşük tepe seviyelerinde kalır; göstergeyi okunur kılmak için ölçeklenir.
          value={Math.min(100, Math.round(recorder.level * 300))}
        />
      )}

      {recording && recorder.silent && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Mikrofon sessiz görünüyor</AlertTitle>
          <AlertDescription>
            Mikrofon sessize alınmış ya da yanlış cihaz seçilmiş olabilir. Ses geldiğinde bu uyarı
            kendiliğinden kalkar.
          </AlertDescription>
        </Alert>
      )}

      {recorder.microphoneDeniedFor === meetingId && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Mikrofon erişimi verilmedi</AlertTitle>
          <AlertDescription>
            <p>
              Kayıt alabilmek için Meetanalyzing&apos;e mikrofon izni vermelisin. İzni Sistem
              Ayarları &gt; Gizlilik ve Güvenlik &gt; Mikrofon bölümünden açabilirsin.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => void window.api.recordings.openMicrophoneSettings()}>
                Sistem Ayarları&apos;nı aç
              </Button>
              <Button size="sm" variant="outline" onClick={start} disabled={busy}>
                Tekrar dene
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
