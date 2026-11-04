import { MicIcon, SquareIcon, TriangleAlertIcon, VolumeXIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert'
import { Button } from '@renderer/components/ui/button'
import { Progress } from '@renderer/components/ui/progress'
import { PLATFORM } from '@renderer/lib/platform'
import { formatElapsed } from './format-elapsed'
import { microphonePermissionCopy } from './microphone-permission'
import { isBusyWith } from './recorder-controller'
import type { Recorder } from './use-recorder'

const permissionCopy = microphonePermissionCopy(PLATFORM)

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
  // Bilgilendirme kabul edilir ve kayıt aynı tıklamayla başlar; kabul ayarlarda saklanır, bir daha sorulmaz.
  const acceptConsent = async (): Promise<void> => {
    const result = await window.api.settings.acceptSystemAudioConsent()
    if (result.ok) await recorder.start(meetingId)
    else toast.error(result.message)
  }

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
        <div className="flex flex-col gap-2">
          <LevelMeter label="Sen" level={recorder.level} />
          <LevelMeter label="Toplantı" level={recorder.systemLevel} />
        </div>
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

      {recorder.consentRequiredFor === meetingId && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Toplantıdaki diğer katılımcıların sesi de kaydedilecek</AlertTitle>
          <AlertDescription>
            <p>
              Meetanalyzing mikrofonunun yanında bilgisayarının sistem sesini de kaydeder; yani
              toplantıdaki diğer katılımcıların sesini de. Katılımcıları bilgilendirmek senin
              sorumluluğundadır. Ses yalnızca bu cihazda kalır, Transcript&apos;i onayladığında
              silinir; analiz için yalnızca metin gönderilir.
            </p>
            <div className="mt-3">
              <Button size="sm" onClick={() => void acceptConsent()} disabled={busy}>
                Anladım, kaydı başlat
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {recorder.interrupted?.meetingId === meetingId && !here && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>
            {recorder.interrupted.channel === 'system' ? 'Sistem sesi kesildi' : 'Mikrofon kesildi'}
          </AlertTitle>
          <AlertDescription>
            <p>
              {recorder.interrupted.channel === 'system'
                ? 'Çıkış cihazı değişmiş (ör. kulaklık takıldı ya da çıkarıldı) ya da sistem sesi izni geri alınmış olabilir.'
                : 'Mikrofon çıkarılmış ya da mikrofon izni geri alınmış olabilir.'}{' '}
              Kayıt durduruldu; o ana kadarki kısım korundu.
            </p>
            <div className="mt-3">
              <Button size="sm" onClick={start} disabled={busy || busyElsewhere}>
                Yeni Recording başlat
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {recorder.quietMeetingFor === meetingId && !here && (
        <Alert>
          <VolumeXIcon />
          <AlertTitle>Toplantı sesi duyulmadı</AlertTitle>
          <AlertDescription>
            Kayıt boyunca mikrofonunda konuşma duyuldu ama bilgisayarın sesi hiç yakalanmadı.
            Toplantıdaki diğer katılımcılar konuşmuyor olabilir ya da toplantı sesi çalmıyordur (ör.
            toplantı sessize alınmış, uygulamanın ses çıkışı kapalı). Sistem sesi kaydı iznini de
            kontrol et; diğer katılımcılar sesleri duyulmadığı sürece Transcript&apos;e girmez.
          </AlertDescription>
        </Alert>
      )}

      {recorder.systemAudioDeniedFor === meetingId && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Sistem sesi izni verilmedi</AlertTitle>
          <AlertDescription>
            <p>
              Toplantıdaki diğer katılımcıları kaydedebilmek için Meetanalyzing&apos;e sistem sesi
              kaydı izni vermelisin. İzni Sistem Ayarları &gt; Gizlilik ve Güvenlik &gt; Ekran ve
              Sistem Ses Kaydı bölümünde, &quot;Yalnızca Sistem Ses Kaydı&quot; listesinden
              açabilirsin. İki izinden biri yoksa kayıt başlamaz.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => void window.api.recordings.openSystemAudioSettings()}
              >
                Sistem Ayarları&apos;nı aç
              </Button>
              <Button size="sm" variant="outline" onClick={start} disabled={busy}>
                Tekrar dene
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {recorder.microphoneDeniedFor === meetingId && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Mikrofon erişimi verilmedi</AlertTitle>
          <AlertDescription>
            <p>{permissionCopy.instructions}</p>
            <div className="mt-3 flex gap-2">
              {permissionCopy.settingsButton && (
                <Button
                  size="sm"
                  onClick={() => void window.api.recordings.openMicrophoneSettings()}
                >
                  {permissionCopy.settingsButton}
                </Button>
              )}
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

// Konuşma düşük tepe seviyelerinde kalır; göstergeyi okunur kılmak için ölçeklenir (docs/tuning.md → Seviye göstergesi).
function LevelMeter({ label, level }: { label: string; level: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-sm text-muted-foreground">{label}</span>
      <Progress
        aria-label={`${label} ses seviyesi`}
        value={Math.min(100, Math.round(level * 300))}
      />
    </div>
  )
}
