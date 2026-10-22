import { DoorClosedIcon, EllipsisIcon, FileTextIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { NavLink } from 'react-router'
import type { MeetingSummary } from '@shared/meeting'
import type { TranscriptionStatus } from '@shared/transcription'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@renderer/components/ui/sidebar'
import { paths } from '../../app/paths'
import { allowedActions, type MeetingAction } from './allowed-actions'
import { DeleteMeetingDialog } from './delete-meeting-dialog'
import { ACTION_LABELS } from './labels'
import { meetingLabel } from './meeting-label'
import { MeetingStatusIcon } from './meeting-status-icon'
import { TitleInput } from './title-input'

/** Satır menüsünün kullandığı işlemler; detaydaki düğmelerle aynı yoldan geçer. */
export interface MeetingRowCommands {
  /** Başarılıysa true; hata gösterimi çağıranın işidir. */
  rename: (id: string, title: string) => Promise<boolean>
  close: (id: string) => void
  /** Model yoksa model sorusu açılır (forceAsk). */
  transcribe: (id: string) => void
  /** Silme onaylandı; kayıt sürüyorsa önce Recording biter. */
  remove: (id: string) => void
  /** Meeting'in sürmekte olan bir kaydı var mı; varken Meeting kapatılamaz, önce kayıt durdurulur. */
  hasActiveRecording: (id: string) => boolean
}

interface Props {
  meeting: MeetingSummary
  active: boolean
  transcription: TranscriptionStatus
  commands: MeetingRowCommands
}

const ACTION_ICONS: Record<MeetingAction, typeof PencilIcon> = {
  rename: PencilIcon,
  close: DoorClosedIcon,
  transcribe: FileTextIcon,
  remove: Trash2Icon
}

// Sidebar'daki Meeting satırı. Sağ tık ve hover'da beliren "⋯" aynı menüyü açar (spec: "Sidebar > Meeting
// listesi"); yalnızca Meeting'in durumunda geçerli aksiyonlar sunulur.
export function MeetingRow({ meeting, active, transcription, commands }: Props): React.JSX.Element {
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Yeniden adlandırma menü tamamen kapandıktan sonra başlar: kapanırken odak menüyü açan öğeye
  // döner ve yeni açılan input'un odağını çalardı.
  const renameRequested = useRef(false)
  const label = meetingLabel(meeting)

  function run(action: MeetingAction): void {
    if (action === 'rename') renameRequested.current = true
    else if (action === 'close') commands.close(meeting.id)
    else if (action === 'transcribe') commands.transcribe(meeting.id)
    else setConfirmingDelete(true)
  }

  function onMenuClosed(open: boolean): void {
    if (open || !renameRequested.current) return
    renameRequested.current = false
    setRenaming(true)
  }

  // Sağ tık ve "⋯" aynı öğeleri gösterir. ContextMenu.Item ve Menu.Item base-ui'de aynı bileşendir.
  const items = allowedActions(meeting).map((action) => {
    const Icon = ACTION_ICONS[action]
    return (
      <DropdownMenuItem
        key={action}
        disabled={action === 'close' && commands.hasActiveRecording(meeting.id)}
        onClick={() => run(action)}
      >
        <Icon /> {ACTION_LABELS[action]}
      </DropdownMenuItem>
    )
  })

  return (
    <>
      {renaming ? (
        <SidebarMenuItem>
          <TitleInput
            meeting={meeting}
            placeholder={meetingLabel({ title: null, createdAt: meeting.createdAt })}
            onRename={commands.rename}
            onDone={() => setRenaming(false)}
            className="h-8 px-2 text-sm"
          />
        </SidebarMenuItem>
      ) : (
        <ContextMenu onOpenChangeComplete={onMenuClosed}>
          <ContextMenuTrigger render={<SidebarMenuItem />}>
            <SidebarMenuButton
              isActive={active}
              tooltip={label}
              render={<NavLink to={paths.meeting(meeting.id)} />}
            >
              <span className="grid size-4 shrink-0 place-items-center">
                <MeetingStatusIcon meeting={meeting} transcription={transcription} />
              </span>
              <span className="truncate">{label}</span>
              {/* Hover'da ya da menü açıkken "⋯" aynı yere gelir; tarih onun altında kalmasın. */}
              <span className="ml-auto text-xs text-muted-foreground group-focus-within/menu-item:invisible group-hover/menu-item:invisible group-has-[[aria-expanded=true]]/menu-item:invisible">
                {format(meeting.createdAt, 'd MMM', { locale: tr })}
              </span>
            </SidebarMenuButton>
            <DropdownMenu onOpenChangeComplete={onMenuClosed}>
              <DropdownMenuTrigger
                render={<SidebarMenuAction showOnHover aria-label={`${label} işlemleri`} />}
              >
                <EllipsisIcon />
              </DropdownMenuTrigger>
              {/* Portal'daki popup'ta sağ tık React ağacında satıra kabarcıklanıp ikinci bir menü açmasın. */}
              <DropdownMenuContent
                side="right"
                align="start"
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                {items}
              </DropdownMenuContent>
            </DropdownMenu>
          </ContextMenuTrigger>
          <ContextMenuContent>{items}</ContextMenuContent>
        </ContextMenu>
      )}
      <DeleteMeetingDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onConfirm={() => commands.remove(meeting.id)}
      />
    </>
  )
}
