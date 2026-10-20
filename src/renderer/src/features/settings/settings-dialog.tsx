import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LANGUAGES, type Language } from '@shared/meeting'
import type { AppInfo } from '@shared/app'
import { THEMES, type Theme } from '@shared/settings'
import { Button } from '@renderer/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@renderer/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@renderer/components/ui/native-select'
import { IS_MAC } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { LANGUAGE_LABELS } from '../meetings/labels'
import { SECTION_LABELS, THEME_LABELS } from './labels'
import type { DefaultLanguageApi } from './use-default-language'
import { SETTINGS_SECTIONS, type SettingsDialogApi } from './use-settings-dialog'
import { useTheme } from './use-theme'

interface Props {
  dialog: SettingsDialogApi
  language: DefaultLanguageApi
}

// Solunda bölüm menüsü olan Ayarlar dialog'u. Uygulama kabuğunda yaşar; Recording'i etkilemez.
export function SettingsDialog({ dialog, language }: Props): React.JSX.Element {
  return (
    <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
      <DialogContent className="grid h-[min(480px,calc(100vh-4rem))] grid-cols-[160px_1fr] gap-0 p-0 sm:max-w-3xl">
        <nav
          aria-label="Ayarlar bölümleri"
          className="flex flex-col gap-1 border-r-2 border-border p-3"
        >
          <DialogTitle className="px-2 pb-2">Ayarlar</DialogTitle>
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section}
              type="button"
              aria-current={dialog.section === section ? 'page' : undefined}
              onClick={() => dialog.setSection(section)}
              className={cn(
                'rounded-base border-2 border-transparent px-2 py-1.5 text-left text-sm',
                dialog.section === section
                  ? 'border-border bg-main text-main-foreground'
                  : 'hover:border-border'
              )}
            >
              {SECTION_LABELS[section]}
            </button>
          ))}
        </nav>
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-6 pr-12">
          <h2 className="text-lg font-heading">{SECTION_LABELS[dialog.section]}</h2>
          {dialog.section === 'general' && <GeneralSection language={language} />}
          {dialog.section === 'about' && <AboutSection />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GeneralSection({ language }: { language: DefaultLanguageApi }): React.JSX.Element {
  const { theme, setTheme } = useTheme()

  return (
    <>
      <Field>
        <FieldLabel htmlFor="settings-theme">Tema</FieldLabel>
        <NativeSelect
          id="settings-theme"
          value={theme}
          onChange={(event) => setTheme(event.target.value as Theme)}
        >
          {THEMES.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {THEME_LABELS[option]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldDescription>Sistem, işletim sisteminin açık/koyu ayarını izler.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-default-language">Varsayılan dil</FieldLabel>
        <NativeSelect
          id="settings-default-language"
          value={language.language}
          onChange={(event) => void language.setLanguage(event.target.value as Language)}
        >
          {LANGUAGES.map((code) => (
            <NativeSelectOption key={code} value={code}>
              {LANGUAGE_LABELS[code]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldDescription>Yeni Meeting&apos;lere bu dil önerilir.</FieldDescription>
      </Field>
    </>
  )
}

function AboutSection(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.app.getInfo().then((value) => {
      if (!cancelled) setInfo(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function showDataFolder(): Promise<void> {
    const error = await window.api.app.showDataFolder()
    if (error) toast.error(`Veri klasörü açılamadı: ${error}`)
  }

  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Uygulama sürümü</dt>
        <dd>{info?.appVersion ?? '…'}</dd>
        <dt className="text-muted-foreground">whisper.cpp sürümü</dt>
        <dd>{info?.whisperVersion ?? '…'}</dd>
      </dl>
      <div>
        <Button variant="neutral" onClick={showDataFolder}>
          {IS_MAC ? "Veri klasörünü Finder'da göster" : 'Veri klasörünü aç'}
        </Button>
      </div>
    </>
  )
}
